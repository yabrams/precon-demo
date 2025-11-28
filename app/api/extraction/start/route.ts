/**
 * POST /api/extraction/start
 *
 * Starts a new extraction session for a project.
 * Supports two modes:
 * - Standard (default): Fast 3-pass extraction (~$0.65, 2-4 min)
 * - Comprehensive: Full 5-pass extraction (~$1.10, 5-8 min)
 *
 * @example
 * POST /api/extraction/start
 * {
 *   "projectId": "proj-123",
 *   "documentIds": ["doc-1", "doc-2"],
 *   "mode": "standard" // or "comprehensive"
 * }
 */

import { NextResponse } from 'next/server';
import {
  ExtractionService,
  ExtractionMode,
  ExtractionInput,
} from '@/lib/extraction';
import { prisma } from '@/lib/prisma';

/**
 * Request body for starting an extraction
 */
interface StartExtractionRequest {
  /** Project ID to extract for */
  projectId: string;

  /** Document IDs to extract from */
  documentIds: string[];

  /**
   * Extraction mode
   * - "standard": Fast 3-pass (default)
   * - "comprehensive": Full 5-pass
   */
  mode?: 'standard' | 'comprehensive';

  /** Optional trades to focus on */
  focusTrades?: string[];

  /** Optional trades to skip */
  skipTrades?: string[];

  /** Minimum confidence threshold (0-1) */
  minimumConfidence?: number;
}

/**
 * Response from starting an extraction
 */
interface StartExtractionResponse {
  /** Session ID for tracking */
  sessionId: string;

  /** Current status */
  status: string;

  /** Mode being used */
  mode: 'standard' | 'comprehensive';

  /** Estimated duration in seconds */
  estimatedDuration: number;

  /** Estimated cost in USD */
  estimatedCost: number;
}

// Store for active extraction sessions (for progress tracking)
// In production, this would be Redis or similar
const activeSessions = new Map<
  string,
  { status: string; progress: number; itemsFound: number; observationsFound: number }
>();

export async function POST(request: Request) {
  try {
    const body: StartExtractionRequest = await request.json();
    const {
      projectId,
      documentIds,
      mode = 'standard',
      focusTrades,
      skipTrades,
      minimumConfidence,
    } = body;

    // Validate inputs
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'documentIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.buildingConnectedProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify documents exist and get their details
    const documents = await prisma.diagram.findMany({
      where: { id: { in: documentIds } },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No valid documents found' }, { status: 400 });
    }

    // Check for API key
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Generate session ID
    const sessionId = `ext_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;

    // Convert documents to ExtractionInput format
    const extractionDocs: ExtractionInput[] = documents.map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      url: doc.fileUrl,
      type: inferDocumentType(doc.fileName),
      mimeType: doc.fileType || 'application/pdf',
      pageCount: undefined, // Will be detected during extraction
    }));

    // Get extraction mode
    const extractionMode =
      mode === 'comprehensive' ? ExtractionMode.Comprehensive : ExtractionMode.Standard;

    // Estimate cost
    const costEstimate = ExtractionService.estimateCost(extractionDocs, extractionMode);

    // Track session
    activeSessions.set(sessionId, {
      status: 'initializing',
      progress: 0,
      itemsFound: 0,
      observationsFound: 0,
    });

    // Run extraction asynchronously (don't await)
    ExtractionService.extract({
      projectId,
      documents: extractionDocs,
      mode: extractionMode,
      focusTrades,
      skipTrades,
      minimumConfidence,
      onProgress: (event) => {
        activeSessions.set(sessionId, {
          status: event.status,
          progress: event.progress,
          itemsFound: event.itemsFound,
          observationsFound: event.observationsFound,
        });
      },
    })
      .then((result) => {
        if (result.success) {
          activeSessions.set(sessionId, {
            status: 'completed',
            progress: 100,
            itemsFound: result.summary.totalLineItems,
            observationsFound: result.summary.totalObservations,
          });
          console.log(
            `Extraction ${sessionId} completed: ${result.summary.totalLineItems} items, ${result.summary.totalWorkPackages} packages`
          );
        } else {
          activeSessions.set(sessionId, {
            status: 'failed',
            progress: 0,
            itemsFound: 0,
            observationsFound: 0,
          });
          console.error(`Extraction ${sessionId} failed: ${result.message}`);
        }
      })
      .catch((error) => {
        activeSessions.set(sessionId, {
          status: 'failed',
          progress: 0,
          itemsFound: 0,
          observationsFound: 0,
        });
        console.error(`Extraction ${sessionId} error:`, error);
      });

    // Estimate duration based on mode and document count
    const baseDuration = extractionMode === ExtractionMode.Standard ? 120 : 240; // 2 or 4 minutes base
    const perDocDuration = 30; // 30 seconds per document
    const estimatedDuration = baseDuration + documents.length * perDocDuration;

    const response: StartExtractionResponse = {
      sessionId,
      status: 'initializing',
      mode: mode === 'comprehensive' ? 'comprehensive' : 'standard',
      estimatedDuration,
      estimatedCost: costEstimate.estimatedCost,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Start extraction error:', error);
    return NextResponse.json({ error: 'Failed to start extraction' }, { status: 500 });
  }
}

/**
 * Infer document type from filename
 */
function inferDocumentType(
  fileName: string
): 'design_drawings' | 'specifications' | 'addendum' | 'other' {
  const lower = fileName.toLowerCase();

  if (lower.includes('addendum') || lower.includes('add_')) {
    return 'addendum';
  }
  if (
    lower.includes('spec') ||
    lower.includes('manual') ||
    lower.includes('project_manual')
  ) {
    return 'specifications';
  }
  if (
    lower.includes('drawing') ||
    lower.includes('plan') ||
    lower.includes('sheet') ||
    lower.endsWith('.pdf')
  ) {
    return 'design_drawings';
  }

  return 'other';
}

/**
 * GET /api/extraction/start
 *
 * Returns information about the extraction API modes.
 */
export async function GET() {
  return NextResponse.json({
    modes: {
      standard: {
        description: 'Fast 3-pass extraction (Extract → Review → Validate)',
        passes: 3,
        typicalCost: '$0.65',
        typicalDuration: '2-4 minutes',
        coverage: '~95%',
        recommended: true,
      },
      comprehensive: {
        description: 'Full 5-pass extraction for maximum coverage',
        passes: 5,
        typicalCost: '$1.10',
        typicalDuration: '5-8 minutes',
        coverage: '~99%',
        recommended: false,
        useCase: 'High-value projects where completeness is critical',
      },
    },
    usage: {
      endpoint: 'POST /api/extraction/start',
      body: {
        projectId: 'string (required)',
        documentIds: 'string[] (required)',
        mode: '"standard" | "comprehensive" (optional, default: "standard")',
        focusTrades: 'string[] (optional)',
        skipTrades: 'string[] (optional)',
        minimumConfidence: 'number 0-1 (optional)',
      },
    },
  });
}
