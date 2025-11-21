import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bid-forms/[id]
 * Fetch a single bid form by ID with line items
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const bidForm = await prisma.bidForm.findUnique({
      where: { id },
      include: {
        bidPackage: true,
        diagram: true,
        lineItems: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!bidForm) {
      return NextResponse.json(
        { error: 'Bid form not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ bidForm });
  } catch (error) {
    console.error('Error fetching bid form:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bid form' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT /api/bid-forms/[id]
 * Update a bid form and its line items
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const {
      extractionConfidence,
      rawExtractedText,
      status,
      lineItems
    } = body;

    // Update bid form
    const updatedBidForm = await prisma.bidForm.update({
      where: { id },
      data: {
        ...(extractionConfidence !== undefined && { extractionConfidence }),
        ...(rawExtractedText !== undefined && { rawExtractedText }),
        ...(status && { status })
      }
    });

    // Update line items if provided
    if (lineItems && Array.isArray(lineItems)) {
      // Delete existing line items
      await prisma.lineItem.deleteMany({
        where: { bidFormId: id }
      });

      // Create new line items
      await prisma.lineItem.createMany({
        data: lineItems.map((item: any, index: number) => ({
          bidFormId: id,
          itemNumber: item.item_number || item.itemNumber,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unit_price || item.unitPrice,
          totalPrice: item.total_price || item.totalPrice,
          notes: item.notes,
          order: item.order !== undefined ? item.order : index,
          verified: item.verified || false
        }))
      });
    }

    // Fetch updated bid form with line items
    const bidForm = await prisma.bidForm.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: {
            order: 'asc'
          }
        },
        diagram: true
      }
    });

    return NextResponse.json({ bidForm });
  } catch (error: any) {
    console.error('Error updating bid form:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Bid form not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update bid form' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE /api/bid-forms/[id]
 * Delete a bid form (cascades to line items)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.bidForm.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bid form:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Bid form not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete bid form' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
