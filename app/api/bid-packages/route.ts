import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bid-packages
 * Get all bid packages for a project
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

    const bidPackages = await prisma.bidPackage.findMany({
      where: { bcProjectId },
      include: {
        bidForms: {
          include: {
            diagram: true,
            lineItems: {
              orderBy: {
                order: 'asc'
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ bidPackages });
  } catch (error) {
    console.error('Error fetching bid packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bid packages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bid-packages
 * Create a new bid package
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bcBidPackageId,
      bcProjectId,
      name,
      description,
      scope,
      bidDueDate,
      status,
      progress,
      diagramIds,
      lineItems // NEW: Support creating line items in same call
    } = body;

    // Validate required fields
    if (!bcBidPackageId || !bcProjectId || !name) {
      return NextResponse.json(
        { error: 'bcBidPackageId, bcProjectId, and name are required' },
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

    // Create bid package
    const bidPackage = await prisma.bidPackage.create({
      data: {
        bcBidPackageId,
        bcProjectId,
        name,
        description,
        scope,
        bidDueDate: bidDueDate ? new Date(bidDueDate) : null,
        status: status || 'draft',
        progress: progress || 0,
        diagramIds: diagramIds ? JSON.stringify(diagramIds) : null
      },
      include: {
        bidForms: true
      }
    });

    // If line items are provided, create a bid form with them
    if (lineItems && lineItems.length > 0) {
      const diagramId = diagramIds && diagramIds.length > 0 ? diagramIds[0] : null;

      await prisma.bidForm.create({
        data: {
          bidPackageId: bidPackage.id,
          diagramId,
          extractionConfidence: 'high',
          status: 'draft',
          lineItems: {
            create: lineItems
          }
        },
        include: {
          lineItems: {
            orderBy: {
              order: 'asc'
            }
          }
        }
      });
    }

    // Fetch the complete bid package with forms and line items
    const completeBidPackage = await prisma.bidPackage.findUnique({
      where: { id: bidPackage.id },
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

    return NextResponse.json({ bidPackage: completeBidPackage }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bid package:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A bid package with this bcBidPackageId already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create bid package' },
      { status: 500 }
    );
  }
}
