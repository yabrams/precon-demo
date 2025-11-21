import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

/**
 * GET /api/diagrams/[id]
 * Fetch a single diagram by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const diagram = await prisma.diagram.findUnique({
      where: { id },
      include: {
        bidForms: {
          include: {
            lineItems: {
              orderBy: {
                order: 'asc'
              }
            }
          }
        }
      }
    });

    if (!diagram) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ diagram });
  } catch (error) {
    console.error('Error fetching diagram:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagram' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT /api/diagrams/[id]
 * Update diagram metadata
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const { category, description, tags } = body;

    const diagram = await prisma.diagram.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags })
      }
    });

    return NextResponse.json({ diagram });
  } catch (error: any) {
    console.error('Error updating diagram:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update diagram' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/diagrams/[id]
 * Delete a diagram and its associated file
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get diagram to access file path
    const diagram = await prisma.diagram.findUnique({
      where: { id }
    });

    if (!diagram) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    // Delete from database (cascades to related bidForms)
    await prisma.diagram.delete({
      where: { id }
    });

    // Try to delete physical file if it's a local upload
    if (diagram.fileUrl.startsWith('/uploads/')) {
      try {
        const filePath = path.join(process.cwd(), 'public', diagram.fileUrl);
        await unlink(filePath);
      } catch (fileError) {
        // Log but don't fail the request if file deletion fails
        console.error('Error deleting file:', fileError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting diagram:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete diagram' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
