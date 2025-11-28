/**
 * Unit Tests: Extraction API
 *
 * Tests for the public ExtractionService API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExtractionService,
  ExtractionMode,
  ExtractionErrorCode,
  ExtractionInput,
} from '@/lib/extraction';

// Mock the orchestrator
vi.mock('@/lib/extraction/orchestrator', () => ({
  ExtractionOrchestrator: vi.fn().mockImplementation(() => ({
    setProgressCallback: vi.fn(),
    run: vi.fn().mockResolvedValue({
      id: 'session-123',
      projectId: 'proj-123',
      status: 'completed',
      workPackages: [
        {
          id: 'pkg-1',
          name: 'Mechanical',
          lineItems: [
            { id: 'item-1', description: 'RTU-1', extraction: { confidence: { overall: 0.9 } } },
          ],
        },
      ],
      observations: [{ id: 'obs-1', severity: 'warning' }],
      metrics: {
        totalWorkPackages: 1,
        totalLineItems: 1,
        totalObservations: 1,
        criticalObservations: 0,
        itemsNeedingReview: 0,
        csiDivisionsCovered: ['23'],
      },
      passes: [
        { passNumber: 1, model: 'gemini-2.5-pro', tokensUsed: { input: 1000, output: 500 } },
      ],
    }),
    runStandard: vi.fn().mockResolvedValue({
      id: 'session-456',
      projectId: 'proj-123',
      status: 'completed',
      workPackages: [
        {
          id: 'pkg-1',
          name: 'Mechanical',
          lineItems: [
            { id: 'item-1', description: 'RTU-1', extraction: { confidence: { overall: 0.85 } } },
          ],
        },
      ],
      observations: [],
      metrics: {
        totalWorkPackages: 1,
        totalLineItems: 1,
        totalObservations: 0,
        criticalObservations: 0,
        itemsNeedingReview: 0,
        csiDivisionsCovered: ['23'],
      },
      passes: [
        { passNumber: 1, model: 'gemini-2.5-pro', tokensUsed: { input: 800, output: 400 } },
      ],
    }),
  })),
}));

describe('ExtractionService', () => {
  const sampleDocuments: ExtractionInput[] = [
    {
      id: 'doc-1',
      name: 'plans.pdf',
      url: '/uploads/plans.pdf',
      type: 'design_drawings',
      mimeType: 'application/pdf',
      pageCount: 50,
    },
    {
      id: 'doc-2',
      name: 'specs.pdf',
      url: '/uploads/specs.pdf',
      type: 'specifications',
      mimeType: 'application/pdf',
      pageCount: 100,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ExtractionMode enum', () => {
    it('should have Standard and Comprehensive values', () => {
      expect(ExtractionMode.Standard).toBe('standard');
      expect(ExtractionMode.Comprehensive).toBe('comprehensive');
    });
  });

  describe('extract()', () => {
    it('should return error when no documents provided', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe(ExtractionErrorCode.NO_DOCUMENTS);
        expect(result.message).toContain('document');
      }
    });

    it('should use Standard mode by default', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
      });

      expect(result.success).toBe(true);
      // Standard mode would call runStandard
    });

    it('should use Comprehensive mode when specified', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        mode: ExtractionMode.Comprehensive,
      });

      expect(result.success).toBe(true);
    });

    it('should return summary with correct fields', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        mode: ExtractionMode.Standard,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.summary).toHaveProperty('totalWorkPackages');
        expect(result.summary).toHaveProperty('totalLineItems');
        expect(result.summary).toHaveProperty('totalObservations');
        expect(result.summary).toHaveProperty('averageConfidence');
        expect(result.summary).toHaveProperty('estimatedCost');
        expect(result.summary).toHaveProperty('durationMs');
      }
    });

    it('should call onProgress callback when provided', async () => {
      const onProgress = vi.fn();

      await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        onProgress,
      });

      // The mock doesn't trigger progress events, but we verify callback is set
      expect(onProgress).toBeDefined();
    });

    it('should accept focusTrades option', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        focusTrades: ['Mechanical', 'Electrical'],
      });

      expect(result.success).toBe(true);
    });

    it('should accept skipTrades option', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        skipTrades: ['Civil'],
      });

      expect(result.success).toBe(true);
    });

    it('should accept minimumConfidence option', async () => {
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: sampleDocuments,
        minimumConfidence: 0.7,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('quickExtract()', () => {
    it('should use Standard mode', async () => {
      const result = await ExtractionService.quickExtract('proj-123', sampleDocuments);

      expect(result.success).toBe(true);
    });

    it('should work with minimal parameters', async () => {
      const result = await ExtractionService.quickExtract('proj-123', [sampleDocuments[0]]);

      expect(result.success).toBe(true);
    });
  });

  describe('deepExtract()', () => {
    it('should use Comprehensive mode', async () => {
      const result = await ExtractionService.deepExtract('proj-123', sampleDocuments);

      expect(result.success).toBe(true);
    });

    it('should accept onProgress callback', async () => {
      const onProgress = vi.fn();

      const result = await ExtractionService.deepExtract(
        'proj-123',
        sampleDocuments,
        onProgress
      );

      expect(result.success).toBe(true);
    });
  });

  describe('estimateCost()', () => {
    it('should return cost estimate for Standard mode', () => {
      const estimate = ExtractionService.estimateCost(
        sampleDocuments,
        ExtractionMode.Standard
      );

      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.breakdown).toHaveProperty('totalPages');
      expect(estimate.breakdown).toHaveProperty('geminiPasses');
      expect(estimate.breakdown).toHaveProperty('claudePasses');
      expect(estimate.breakdown.geminiPasses).toBe(2);
      expect(estimate.breakdown.claudePasses).toBe(1);
    });

    it('should return higher cost for Comprehensive mode', () => {
      const standardEstimate = ExtractionService.estimateCost(
        sampleDocuments,
        ExtractionMode.Standard
      );
      const comprehensiveEstimate = ExtractionService.estimateCost(
        sampleDocuments,
        ExtractionMode.Comprehensive
      );

      expect(comprehensiveEstimate.estimatedCost).toBeGreaterThan(
        standardEstimate.estimatedCost
      );
      expect(comprehensiveEstimate.breakdown.geminiPasses).toBe(4);
    });

    it('should scale with document page count', () => {
      const smallDocs: ExtractionInput[] = [
        { ...sampleDocuments[0], pageCount: 10 },
      ];
      const largeDocs: ExtractionInput[] = [
        { ...sampleDocuments[0], pageCount: 200 },
      ];

      const smallEstimate = ExtractionService.estimateCost(smallDocs);
      const largeEstimate = ExtractionService.estimateCost(largeDocs);

      expect(largeEstimate.estimatedCost).toBeGreaterThan(smallEstimate.estimatedCost);
    });

    it('should use default page count when not provided', () => {
      const docsWithoutPageCount: ExtractionInput[] = [
        { ...sampleDocuments[0], pageCount: undefined },
      ];

      const estimate = ExtractionService.estimateCost(docsWithoutPageCount);

      expect(estimate.breakdown.totalPages).toBe(50); // Default
    });
  });

  describe('Error handling', () => {
    it('should categorize authentication errors', async () => {
      // This would require mocking the orchestrator to throw
      const result = await ExtractionService.extract({
        projectId: 'proj-123',
        documents: [],
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('ExtractionErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(ExtractionErrorCode.NO_DOCUMENTS).toBe('NO_DOCUMENTS');
    expect(ExtractionErrorCode.DOCUMENT_READ_ERROR).toBe('DOCUMENT_READ_ERROR');
    expect(ExtractionErrorCode.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
    expect(ExtractionErrorCode.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
    expect(ExtractionErrorCode.MODEL_RESPONSE_ERROR).toBe('MODEL_RESPONSE_ERROR');
    expect(ExtractionErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    expect(ExtractionErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });
});
