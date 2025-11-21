import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/projects/[id]
 * Fetch a single BuildingConnected project by ID with all relations
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const project = await prisma.buildingConnectedProject.findUnique({
      where: { id },
      include: {
        diagrams: {
          orderBy: {
            uploadedAt: 'desc'
          }
        },
        bidPackages: {
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
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        userAssignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                userName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT /api/projects/[id]
 * Update a BuildingConnected project
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const {
      name,
      projectNumber,
      description,
      status,
      bidDueDate,
      expectedStartDate,
      expectedEndDate,
      address,
      city,
      state,
      zipCode,
      country,
      projectSize,
      projectSizeUnit,
      projectValue,
      marketSector,
      typeOfWork,
      architect,
      client,
      accountManager,
      owningOffice,
      feePercentage
    } = body;

    const project = await prisma.buildingConnectedProject.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(projectNumber !== undefined && { projectNumber }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(bidDueDate !== undefined && { bidDueDate: bidDueDate ? new Date(bidDueDate) : null }),
        ...(expectedStartDate !== undefined && { expectedStartDate: expectedStartDate ? new Date(expectedStartDate) : null }),
        ...(expectedEndDate !== undefined && { expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(country !== undefined && { country }),
        ...(projectSize !== undefined && { projectSize }),
        ...(projectSizeUnit !== undefined && { projectSizeUnit }),
        ...(projectValue !== undefined && { projectValue }),
        ...(marketSector !== undefined && { marketSector }),
        ...(typeOfWork !== undefined && { typeOfWork }),
        ...(architect !== undefined && { architect }),
        ...(client !== undefined && { client }),
        ...(accountManager !== undefined && { accountManager }),
        ...(owningOffice !== undefined && { owningOffice }),
        ...(feePercentage !== undefined && { feePercentage })
      },
      include: {
        diagrams: true,
        bidPackages: true
      }
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Error updating project:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a BuildingConnected project (cascades to diagrams and bid packages)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.buildingConnectedProject.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting project:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
