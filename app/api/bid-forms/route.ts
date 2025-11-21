import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/bid-forms
 * Create a new bid form with line items
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      bidPackageId,
      diagramId,
      extractionConfidence,
      rawExtractedText,
      status,
      lineItems
    } = body;

    // Validate required fields
    if (!bidPackageId) {
      return NextResponse.json(
        { error: 'bidPackageId is required' },
        { status: 400 }
      );
    }

    // Verify bid package exists
    const bidPackage = await prisma.bidPackage.findUnique({
      where: { id: bidPackageId }
    });

    if (!bidPackage) {
      return NextResponse.json(
        { error: 'Bid package not found' },
        { status: 404 }
      );
    }

    // Verify diagram exists if provided
    if (diagramId) {
      const diagram = await prisma.diagram.findUnique({
        where: { id: diagramId }
      });

      if (!diagram) {
        return NextResponse.json(
          { error: 'Diagram not found' },
          { status: 404 }
        );
      }
    }

    // Create bid form with line items
    const bidForm = await prisma.bidForm.create({
      data: {
        bidPackageId,
        diagramId,
        extractionConfidence,
        rawExtractedText,
        status: status || 'draft',
        lineItems: lineItems ? {
          create: lineItems.map((item: any, index: number) => ({
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
        } : undefined
      },
      include: {
        lineItems: {
          orderBy: {
            order: 'asc'
          }
        },
        diagram: true
      }
    });

    return NextResponse.json({ bidForm }, { status: 201 });
  } catch (error) {
    console.error('Error creating bid form:', error);
    return NextResponse.json(
      { error: 'Failed to create bid form' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
