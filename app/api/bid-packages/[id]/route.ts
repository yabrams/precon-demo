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
 * GET /api/bid-packages/[id]
 * Fetch a single bid package by ID with all relations
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bidPackage = await prisma.bidPackage.findUnique({
      where: { id },
      include: {
        project: true,
        bidForms: {
          include: {
            diagram: true,
            lineItems: {
              orderBy: {
                order: 'asc'
              }
            }
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

    if (!bidPackage) {
      return NextResponse.json(
        { error: 'Bid package not found' },
        { status: 404 }
      );
    }

    // Calculate progress from workspaceData if not already set
    if (bidPackage.workspaceData && (bidPackage.progress === null || bidPackage.progress === undefined)) {
      try {
        const workspaceData = JSON.parse(bidPackage.workspaceData);
        if (workspaceData.lineItems && Array.isArray(workspaceData.lineItems)) {
          const calculatedProgress = calculateApprovalPercentage(workspaceData.lineItems);

          // Update in database
          await prisma.bidPackage.update({
            where: { id: bidPackage.id },
            data: { progress: calculatedProgress }
          });

          // Update returned object
          bidPackage.progress = calculatedProgress;
        }
      } catch (error) {
        console.error('Error calculating progress from workspaceData:', error);
      }
    }

    return NextResponse.json({ bidPackage });
  } catch (error) {
    console.error('Error fetching bid package:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bid package' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bid-packages/[id]
 * Update a bid package
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
      description,
      scope,
      bidDueDate,
      status,
      progress,
      diagramIds,
      captainId,
      captainName,
      budgetAmount,
      location,
      lineItems,
      chatMessages
    } = body;

    // Prepare workspace data if lineItems or chatMessages are provided
    let workspaceData = undefined;
    if (lineItems !== undefined || chatMessages !== undefined) {
      workspaceData = JSON.stringify({
        lineItems: lineItems || [],
        chatMessages: chatMessages || []
      });
    }

    // Auto-calculate progress from line items if provided (unless explicitly set)
    let calculatedProgress = progress;
    if (lineItems !== undefined && progress === undefined) {
      calculatedProgress = calculateApprovalPercentage(lineItems);
      console.log(`Auto-calculated progress: ${calculatedProgress}% (${lineItems.filter((i: any) => i.approved).length}/${lineItems.length} approved)`);
    }

    const bidPackage = await prisma.bidPackage.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(scope !== undefined && { scope }),
        ...(bidDueDate !== undefined && { bidDueDate: bidDueDate ? new Date(bidDueDate) : null }),
        ...(status && { status }),
        ...(calculatedProgress !== undefined && { progress: calculatedProgress }),
        ...(diagramIds !== undefined && { diagramIds: diagramIds ? JSON.stringify(diagramIds) : null }),
        ...(captainId !== undefined && { captainId }),
        ...(captainName !== undefined && { captainName }),
        ...(workspaceData !== undefined && { workspaceData }),
        ...(budgetAmount !== undefined && { budgetAmount }),
        ...(location !== undefined && { location })
      },
      include: {
        captain: true,
        bidForms: {
          include: {
            lineItems: true
          }
        }
      }
    });

    return NextResponse.json({ bidPackage });
  } catch (error: any) {
    console.error('Error updating bid package:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Bid package not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update bid package' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bid-packages/[id]
 * Delete a bid package (cascades to bid forms and line items)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.bidPackage.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bid package:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Bid package not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete bid package' },
      { status: 500 }
    );
  }
}
