import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Calculate approval percentage from line items
 */
function calculateApprovalPercentage(lineItems: any[]): number {
  if (!lineItems || lineItems.length === 0) {
    return 0;
  }

  const approvedCount = lineItems.filter(item => item.approved === true).length;
  return Math.round((approvedCount / lineItems.length) * 100);
}

/**
 * GET /api/projects/[id]
 * Fetch a single BuildingConnected project by ID with all relations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Calculate and update progress for all bid packages if needed
    if (project.bidPackages && project.bidPackages.length > 0) {
      const updates: Promise<any>[] = [];

      project.bidPackages.forEach((bidPackage: any) => {
        // Check if progress needs to be calculated
        if (bidPackage.progress === null || bidPackage.progress === undefined) {
          // Try from workspaceData first
          if (bidPackage.workspaceData) {
            try {
              const workspaceData = JSON.parse(bidPackage.workspaceData);
              if (workspaceData.lineItems && Array.isArray(workspaceData.lineItems)) {
                const calculatedProgress = calculateApprovalPercentage(workspaceData.lineItems);
                bidPackage.progress = calculatedProgress;

                // Queue database update
                updates.push(
                  prisma.bidPackage.update({
                    where: { id: bidPackage.id },
                    data: { progress: calculatedProgress }
                  })
                );
              }
            } catch (error) {
              console.error('Error parsing workspaceData for bid package:', bidPackage.id, error);
            }
          }
          // Or calculate from bidForms lineItems
          else if (bidPackage.bidForms && bidPackage.bidForms.length > 0) {
            let totalItems = 0;
            let approvedItems = 0;

            bidPackage.bidForms.forEach((bidForm: any) => {
              if (bidForm.lineItems && Array.isArray(bidForm.lineItems)) {
                totalItems += bidForm.lineItems.length;
                approvedItems += bidForm.lineItems.filter((item: any) => item.approved === true).length;
              }
            });

            if (totalItems > 0) {
              const calculatedProgress = Math.round((approvedItems / totalItems) * 100);
              bidPackage.progress = calculatedProgress;

              // Queue database update
              updates.push(
                prisma.bidPackage.update({
                  where: { id: bidPackage.id },
                  data: { progress: calculatedProgress }
                })
              );
            }
          }
        }
      });

      // Execute all updates in parallel
      if (updates.length > 0) {
        await Promise.all(updates).catch(error => {
          console.error('Error updating bid package progress:', error);
        });
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]
 * Update a BuildingConnected project
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
  }
}

/**
 * DELETE /api/projects/[id]
 * Soft delete a BuildingConnected project (sets deletedAt timestamp)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.buildingConnectedProject.update({
      where: { id },
      data: { deletedAt: new Date() }
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
  }
}
