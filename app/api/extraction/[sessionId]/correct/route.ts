/**
 * POST /api/extraction/[sessionId]/correct
 *
 * Submit a human correction for an extracted item.
 * Records prediction vs. actual for Phase 2 learning.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CorrectionRequest {
  entityType: 'line_item' | 'work_package';
  entityId: string;
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  reason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body: CorrectionRequest = await request.json();

    const { entityType, entityId, field, originalValue, correctedValue, reason } = body;

    if (!entityType || !entityId || !field) {
      return NextResponse.json(
        { error: 'entityType, entityId, and field are required' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.extractionSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update the actual entity
    if (entityType === 'line_item') {
      const item = await prisma.extractedLineItemRecord.findUnique({
        where: { id: entityId },
      });

      if (!item) {
        return NextResponse.json(
          { error: 'Line item not found' },
          { status: 404 }
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        [field]: correctedValue,
        humanReviewed: true,
        humanReviewedAt: new Date(),
      };

      // Track corrections
      const existingCorrections = item.humanCorrections
        ? JSON.parse(item.humanCorrections)
        : [];
      existingCorrections.push({
        field,
        originalValue,
        correctedValue,
        reason,
        timestamp: new Date().toISOString(),
      });
      updateData.humanCorrections = JSON.stringify(existingCorrections);

      await prisma.extractedLineItemRecord.update({
        where: { id: entityId },
        data: updateData,
      });
    } else if (entityType === 'work_package') {
      const pkg = await prisma.extractedWorkPackageRecord.findUnique({
        where: { id: entityId },
      });

      if (!pkg) {
        return NextResponse.json(
          { error: 'Work package not found' },
          { status: 404 }
        );
      }

      await prisma.extractedWorkPackageRecord.update({
        where: { id: entityId },
        data: {
          [field]: correctedValue,
        },
      });
    }

    // Record prediction for Phase 2 learning
    const predictionRecord = await prisma.predictionRecord.create({
      data: {
        sessionId,
        entityType,
        entityId,
        fieldName: field,
        predictedValue: JSON.stringify(originalValue),
        predictedConfidence: 0.7, // Default, would be from actual extraction
        predictedBy: 'gemini-2.5-pro',
        finalValue: JSON.stringify(correctedValue),
        finalSource: 'human_correction',
        correctedAt: new Date(),
        wasCorrect: JSON.stringify(originalValue) === JSON.stringify(correctedValue),
        contextData: JSON.stringify({ reason }),
      },
    });

    return NextResponse.json({
      success: true,
      predictionRecordId: predictionRecord.id,
    });
  } catch (error) {
    console.error('Correction error:', error);
    return NextResponse.json(
      { error: 'Failed to record correction' },
      { status: 500 }
    );
  }
}
