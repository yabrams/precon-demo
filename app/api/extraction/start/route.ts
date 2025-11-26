/**
 * POST /api/extraction/start
 *
 * Starts a new extraction session for a project.
 * Runs asynchronously and returns session ID for tracking.
 */

import { NextResponse } from 'next/server';
import { runExtraction } from '@/lib/extraction/orchestrator';
import {
  StartExtractionRequest,
  StartExtractionResponse,
  DEFAULT_EXTRACTION_CONFIG,
} from '@/lib/extraction/types';
import { prisma } from '@/lib/prisma';

// Store for active extraction sessions (for progress tracking)
// In production, this would be Redis or similar
const activeSessions = new Map<string, { status: string; progress: number }>();

export async function POST(request: Request) {
  try {
    const body: StartExtractionRequest = await request.json();
    const { projectId, documentIds, config } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds array is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.buildingConnectedProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify documents exist
    const documents = await prisma.diagram.findMany({
      where: {
        id: { in: documentIds },
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'No valid documents found' },
        { status: 400 }
      );
    }

    // Check for GOOGLE_AI_API_KEY
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Generate session ID
    const sessionId = `ext_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;

    // Start extraction asynchronously
    const extractionConfig = {
      ...DEFAULT_EXTRACTION_CONFIG,
      ...config,
    };

    // Track session
    activeSessions.set(sessionId, { status: 'initializing', progress: 0 });

    // Run extraction in background (don't await)
    runExtraction(
      projectId,
      documentIds,
      extractionConfig,
      (event) => {
        // Update session tracking
        if (event.type === 'status') {
          const data = event.data as { status: string; progress: number };
          activeSessions.set(sessionId, {
            status: data.status,
            progress: data.progress,
          });
        }
      }
    )
      .then((session) => {
        activeSessions.set(sessionId, {
          status: 'completed',
          progress: 100,
        });
        console.log(`Extraction ${sessionId} completed with ${session.workPackages.length} packages`);
      })
      .catch((error) => {
        activeSessions.set(sessionId, {
          status: 'failed',
          progress: 0,
        });
        console.error(`Extraction ${sessionId} failed:`, error);
      });

    // Estimate duration based on document count
    const estimatedDuration = documents.length * 30; // ~30 seconds per document

    const response: StartExtractionResponse = {
      sessionId,
      status: 'initializing',
      estimatedDuration,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Start extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to start extraction' },
      { status: 500 }
    );
  }
}
