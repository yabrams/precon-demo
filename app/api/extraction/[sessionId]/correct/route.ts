/**
 * POST /api/extraction/[sessionId]/correct
 *
 * Submit human corrections for extracted items.
 * Supports single corrections and batch corrections.
 * Records prediction vs. actual for Phase 2 learning.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Single field correction
interface SingleCorrectionRequest {
  entityType: 'line_item' | 'work_package';
  entityId: string;
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  reason?: string;
}

// Batch correction types
interface LineItemCorrection {
  type: 'line_item';
  lineItemId: string;
  workPackageId: string;
  corrections: Record<string, unknown>;
  reviewerComment?: string;
}

interface ObservationAction {
  type: 'observation';
  observationId: string;
  action: 'acknowledge' | 'dismiss' | 'respond';
  userResponse?: string;
}

interface NewLineItem {
  type: 'new_line_item';
  workPackageId: string;
  lineItem: {
    itemNumber?: string;
    description: string;
    action: string;
    quantity?: number;
    unit?: string;
    specifications?: string;
    notes?: string;
  };
}

interface DeleteLineItem {
  type: 'delete_line_item';
  lineItemId: string;
  workPackageId: string;
  reason: string;
}

type BatchCorrectionItem = LineItemCorrection | ObservationAction | NewLineItem | DeleteLineItem;

interface BatchCorrectionRequest {
  corrections: BatchCorrectionItem[];
  reviewerId: string;
  reviewerName?: string;
}

// Request can be single correction or batch
type CorrectionRequest = SingleCorrectionRequest | BatchCorrectionRequest;

function isBatchRequest(body: CorrectionRequest): body is BatchCorrectionRequest {
  return 'corrections' in body && Array.isArray(body.corrections);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body: CorrectionRequest = await request.json();

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

    // Handle batch corrections
    if (isBatchRequest(body)) {
      return handleBatchCorrections(sessionId, body);
    }

    // Handle single correction (legacy format)
    const { entityType, entityId, field, originalValue, correctedValue, reason } = body;

    if (!entityType || !entityId || !field) {
      return NextResponse.json(
        { error: 'entityType, entityId, and field are required' },
        { status: 400 }
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

/**
 * Handle batch corrections
 */
async function handleBatchCorrections(
  sessionId: string,
  request: BatchCorrectionRequest
) {
  const { corrections, reviewerId, reviewerName } = request;
  const results: { type: string; id: string; success: boolean; error?: string }[] = [];

  for (const correction of corrections) {
    try {
      switch (correction.type) {
        case 'line_item': {
          const { lineItemId, corrections: updates, reviewerComment } = correction;

          await prisma.extractedLineItemRecord.update({
            where: { id: lineItemId },
            data: {
              ...updates,
              humanReviewed: true,
              humanReviewedBy: reviewerId,
              humanReviewedAt: new Date(),
              humanCorrections: JSON.stringify({
                corrections: updates,
                reviewerComment,
                reviewerName,
                timestamp: new Date(),
              }),
            },
          });

          results.push({ type: 'line_item', id: lineItemId, success: true });
          break;
        }

        case 'observation': {
          const { observationId, action, userResponse } = correction;

          await prisma.aIObservationRecord.update({
            where: { id: observationId },
            data: {
              acknowledged: action === 'acknowledge' || action === 'respond',
              userResponse:
                userResponse || (action === 'dismiss' ? 'Dismissed by reviewer' : undefined),
              respondedAt: new Date(),
              respondedBy: reviewerId,
            },
          });

          results.push({ type: 'observation', id: observationId, success: true });
          break;
        }

        case 'new_line_item': {
          const { workPackageId, lineItem } = correction;

          // Get current max orderIndex
          const existingItems = await prisma.extractedLineItemRecord.findMany({
            where: { workPackageId },
            orderBy: { orderIndex: 'desc' },
            take: 1,
          });

          const nextOrder = existingItems.length > 0 ? existingItems[0].orderIndex + 1 : 0;

          const newItem = await prisma.extractedLineItemRecord.create({
            data: {
              workPackageId,
              itemNumber: lineItem.itemNumber,
              description: lineItem.description,
              action: lineItem.action,
              quantity: lineItem.quantity,
              unit: lineItem.unit,
              specifications: lineItem.specifications,
              notes: lineItem.notes,
              orderIndex: nextOrder,
              extractedBy: 'human',
              extractionPass: 0,
              confidence: 1.0,
              humanReviewed: true,
              humanReviewedBy: reviewerId,
              humanReviewedAt: new Date(),
            },
          });

          // Update work package item count
          await prisma.extractedWorkPackageRecord.update({
            where: { id: workPackageId },
            data: {
              itemCount: { increment: 1 },
            },
          });

          results.push({ type: 'new_line_item', id: newItem.id, success: true });
          break;
        }

        case 'delete_line_item': {
          const { lineItemId, workPackageId, reason } = correction;

          // Soft delete by marking and adding deletion note
          await prisma.extractedLineItemRecord.update({
            where: { id: lineItemId },
            data: {
              humanReviewed: true,
              humanReviewedBy: reviewerId,
              humanReviewedAt: new Date(),
              humanCorrections: JSON.stringify({
                action: 'deleted',
                reason,
                reviewerName,
                timestamp: new Date(),
              }),
            },
          });

          // Update work package item count
          await prisma.extractedWorkPackageRecord.update({
            where: { id: workPackageId },
            data: {
              itemCount: { decrement: 1 },
            },
          });

          results.push({ type: 'delete_line_item', id: lineItemId, success: true });
          break;
        }

        default:
          results.push({
            type: (correction as BatchCorrectionItem).type,
            id: 'unknown',
            success: false,
            error: 'Unknown correction type',
          });
      }
    } catch (error) {
      results.push({
        type: correction.type,
        id: getIdFromCorrection(correction),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: failCount === 0,
    message: `Applied ${successCount} corrections${failCount > 0 ? `, ${failCount} failed` : ''}`,
    results,
    metrics: {
      applied: successCount,
      failed: failCount,
    },
  });
}

function getIdFromCorrection(correction: BatchCorrectionItem): string {
  switch (correction.type) {
    case 'line_item':
      return correction.lineItemId;
    case 'observation':
      return correction.observationId;
    case 'new_line_item':
      return correction.workPackageId;
    case 'delete_line_item':
      return correction.lineItemId;
    default:
      return 'unknown';
  }
}
