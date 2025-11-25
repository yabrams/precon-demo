import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/diagrams
 * Create a new diagram record after file upload
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bcProjectId,
      fileName,
      fileUrl,
      fileType,
      fileSize,
      uploadedBy,
      category,
      description,
      tags
    } = body;

    // Validate required fields
    if (!bcProjectId || !fileName || !fileUrl || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'bcProjectId, fileName, fileUrl, fileType, and fileSize are required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.buildingConnectedProject.findUnique({
      where: { id: bcProjectId }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create diagram
    const diagram = await prisma.diagram.create({
      data: {
        bcProjectId,
        fileName,
        fileUrl,
        fileType,
        fileSize,
        uploadedBy,
        category,
        description,
        tags
      }
    });

    return NextResponse.json({ diagram }, { status: 201 });
  } catch (error) {
    console.error('Error creating diagram:', error);
    return NextResponse.json(
      { error: 'Failed to create diagram' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/diagrams
 * Get all diagrams for a project
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bcProjectId = searchParams.get('bcProjectId');

    if (!bcProjectId) {
      return NextResponse.json(
        { error: 'bcProjectId query parameter is required' },
        { status: 400 }
      );
    }

    const diagrams = await prisma.diagram.findMany({
      where: { bcProjectId },
      include: {
        bidForms: {
          include: {
            lineItems: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    return NextResponse.json({ diagrams });
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagrams' },
      { status: 500 }
    );
  }
}
