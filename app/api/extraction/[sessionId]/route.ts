/**
 * GET /api/extraction/[sessionId]
 *
 * Get extraction session status and results.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ExtractionStatusResponse,
  ExtractionResultsResponse,
  ExtractedWorkPackage,
  ExtractedLineItem,
  AIObservation,
  ExtractionMetrics,
  ExtractionPass,
  ExtractionMetadata,
  ConfidenceScore,
  CSIClassification,
} from '@/lib/extraction/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Get session from database
    const session = await prisma.extractionSession.findUnique({
      where: { id: sessionId },
      include: {
        workPackages: {
          include: {
            lineItems: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        observations: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if caller wants full results or just status
    const url = new URL(request.url);
    const includeResults = url.searchParams.get('results') === 'true';

    if (!includeResults) {
      // Return status only
      const statusResponse: ExtractionStatusResponse = {
        sessionId: session.id,
        status: session.status as any,
        currentPass: session.currentPass,
        progress: session.progress,
        statusMessage: session.statusMessage || undefined,
        metrics: session.metrics ? JSON.parse(session.metrics) : undefined,
        lastUpdate: session.completedAt || session.startedAt,
      };

      return NextResponse.json(statusResponse);
    }

    // Return full results
    const workPackages: ExtractedWorkPackage[] = session.workPackages.map(pkg => ({
      id: pkg.id,
      packageId: pkg.packageId,
      name: pkg.name,
      description: pkg.description || undefined,
      csiClassification: {
        divisionCode: pkg.csiDivisionCode,
        divisionName: pkg.csiDivisionName,
        sectionCode: pkg.csiSectionCode || undefined,
        sectionName: pkg.csiSectionName || undefined,
        level: 1,
        confidence: pkg.csiConfidence,
        reasoning: pkg.csiReasoning || '',
      } as CSIClassification,
      trade: pkg.trade,
      scopeResponsible: pkg.scopeResponsible || undefined,
      lineItems: pkg.lineItems.map(item => ({
        id: item.id,
        itemNumber: item.itemNumber || undefined,
        description: item.description,
        action: item.action,
        quantity: item.quantity || undefined,
        unit: item.unit || undefined,
        specifications: item.specifications || undefined,
        notes: item.notes || undefined,
        references: [],
        order: item.orderIndex,
        extraction: {
          extractedBy: item.extractedBy as any,
          extractedAt: item.createdAt,
          confidence: item.confidenceDetails
            ? JSON.parse(item.confidenceDetails)
            : { overall: item.confidence, components: {}, reasoning: '', flags: [] },
          humanReviewed: item.humanReviewed,
          humanReviewedBy: item.humanReviewedBy || undefined,
          humanReviewedAt: item.humanReviewedAt || undefined,
          extractionPass: item.extractionPass,
        } as ExtractionMetadata,
      })) as ExtractedLineItem[],
      itemCount: pkg.itemCount,
      estimatedComplexity: pkg.complexity as 'low' | 'medium' | 'high',
      keyDocuments: [],
      extraction: {
        extractedBy: pkg.extractedBy as any,
        extractedAt: pkg.createdAt,
        confidence: pkg.confidenceDetails
          ? JSON.parse(pkg.confidenceDetails)
          : { overall: pkg.confidence, components: {}, reasoning: '', flags: [] },
        humanReviewed: false,
        extractionPass: pkg.extractionPass,
      } as ExtractionMetadata,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    }));

    const observations: AIObservation[] = session.observations.map(obs => ({
      id: obs.id,
      severity: obs.severity as any,
      category: obs.category as any,
      title: obs.title,
      insight: obs.insight,
      affectedWorkPackages: obs.affectedPackageIds
        ? JSON.parse(obs.affectedPackageIds)
        : [],
      affectedLineItems: obs.affectedItemIds
        ? JSON.parse(obs.affectedItemIds)
        : undefined,
      references: [],
      suggestedActions: obs.suggestedActions
        ? JSON.parse(obs.suggestedActions)
        : undefined,
      extraction: {
        extractedBy: obs.extractedBy,
        extractedAt: obs.createdAt,
        confidence: {
          overall: obs.confidence,
          components: {
            dataCompleteness: obs.confidence,
            sourceClarity: obs.confidence,
            crossReferenceMatch: 0.5,
            specificationMatch: 0.5,
            quantityReasonableness: obs.confidence,
          },
          reasoning: '',
          flags: [],
        },
        humanReviewed: false,
        extractionPass: 3,
      } as ExtractionMetadata,
      userAcknowledged: obs.acknowledged,
      userResponse: obs.userResponse || undefined,
      userResponseAt: obs.respondedAt || undefined,
    }));

    const resultsResponse: ExtractionResultsResponse = {
      sessionId: session.id,
      status: session.status as any,
      workPackages,
      observations,
      metrics: session.metrics
        ? JSON.parse(session.metrics)
        : {
            totalWorkPackages: workPackages.length,
            totalLineItems: workPackages.reduce((sum, p) => sum + p.lineItems.length, 0),
            totalObservations: observations.length,
            confidenceDistribution: { high: 0, medium: 0, low: 0 },
            csiDivisionsCovered: [...new Set(workPackages.map(p => p.csiClassification.divisionCode))],
            documentsProcessed: 0,
            pagesProcessed: 0,
            itemsNeedingReview: 0,
            criticalObservations: observations.filter(o => o.severity === 'critical').length,
            warningObservations: observations.filter(o => o.severity === 'warning').length,
          },
      passes: session.passes ? JSON.parse(session.passes) : [],
    };

    return NextResponse.json(resultsResponse);
  } catch (error) {
    console.error('Get extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to get extraction session' },
      { status: 500 }
    );
  }
}
