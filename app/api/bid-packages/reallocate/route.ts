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
 * POST /api/bid-packages/reallocate
 * Move a line item from one bid package to another
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, sourcePackageId, targetPackageId, item } = body;

    if (!itemId || !sourcePackageId || !targetPackageId || !item) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, sourcePackageId, targetPackageId, item' },
        { status: 400 }
      );
    }

    // Get target package
    const targetPackage = await prisma.bidPackage.findUnique({
      where: { id: targetPackageId }
    });

    if (!targetPackage) {
      return NextResponse.json(
        { error: 'Target bid package not found' },
        { status: 404 }
      );
    }

    // Parse target package workspace data
    let targetWorkspaceData: { lineItems: any[]; chatMessages: any[] } = {
      lineItems: [],
      chatMessages: []
    };

    if (targetPackage.workspaceData) {
      try {
        targetWorkspaceData = JSON.parse(targetPackage.workspaceData);
      } catch (e) {
        console.error('Failed to parse target workspace data:', e);
      }
    }

    // Add the item to the target package
    const newItem = {
      ...item,
      id: item.id || `reallocated-${Date.now()}`,
      approved: false, // Reset approval status when reallocating
    };

    targetWorkspaceData.lineItems.push(newItem);

    // Calculate progress for target package
    const targetProgress = calculateApprovalPercentage(targetWorkspaceData.lineItems);

    // Update target package with new item
    await prisma.bidPackage.update({
      where: { id: targetPackageId },
      data: {
        workspaceData: JSON.stringify(targetWorkspaceData),
        progress: targetProgress
      }
    });

    return NextResponse.json({
      success: true,
      message: `Item moved to ${targetPackage.name}`,
      targetPackageId,
      itemId: newItem.id
    });
  } catch (error) {
    console.error('Error reallocating item:', error);
    return NextResponse.json(
      { error: 'Failed to reallocate item' },
      { status: 500 }
    );
  }
}
