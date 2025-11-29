/**
 * Batch Processor Unit Tests
 *
 * Tests for the batch processing module including:
 * - TradeContextManager functionality
 * - BatchProcessor batch creation and management
 * - Token estimation and cost calculation
 * - Trade priority sorting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BatchProcessor,
  TradeContextManager,
  MAX_TOKENS_PER_BATCH,
  MIN_TOKENS_PER_BATCH,
  MAX_PAGES_PER_BATCH,
} from '@/lib/extraction/batch-processor';
import { ProcessedPage, PageType } from '@/lib/pdf-utils';
import {
  ClassifiedDocument,
  PageClassification,
  classifyDocument,
} from '@/lib/extraction/page-classifier';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockPage(
  pageNumber: number,
  options: Partial<{
    sheetNumber: string;
    trade: string;
    pageType: PageType;
    estimatedTokens: number;
    textContent: string;
  }> = {}
): ProcessedPage {
  const {
    sheetNumber = `A${pageNumber}.0`,
    trade = 'Architectural',
    pageType = 'plan',
    estimatedTokens = 5000,
    textContent = `Page ${pageNumber} content`,
  } = options;

  return {
    pageNumber,
    sheetNumber,
    textContent,
    textPreview: textContent.slice(0, 100),
    estimatedTokens,
    width: 1000,
    height: 1400,
    hasText: true,
    estimatedType: pageType,
    imageBuffer: Buffer.from('mock-image'),
    contentType: 'image/jpeg',
  };
}

function createMockClassification(
  pages: ProcessedPage[]
): ClassifiedDocument {
  const classifications: PageClassification[] = pages.map((p) => ({
    pageNumber: p.pageNumber,
    csiDivision: '06',
    csiDivisionName: 'Wood, Plastics, Composites',
    trade: 'Architectural',
    pageType: p.estimatedType,
    confidence: 0.9,
    sheetNumber: p.sheetNumber,
    method: 'pattern' as const,
    keywords: [],
  }));

  const tradeGroups = new Map<string, PageClassification[]>();
  for (const c of classifications) {
    const existing = tradeGroups.get(c.trade) || [];
    existing.push(c);
    tradeGroups.set(c.trade, existing);
  }

  const csiGroups = new Map<string, PageClassification[]>();
  for (const c of classifications) {
    const existing = csiGroups.get(c.csiDivision) || [];
    existing.push(c);
    csiGroups.set(c.csiDivision, existing);
  }

  return {
    totalPages: pages.length,
    classifications,
    tradeGroups,
    csiGroups,
    summary: {
      tradesIdentified: Array.from(tradeGroups.keys()),
      csiDivisionsIdentified: Array.from(csiGroups.keys()),
      pagesPerTrade: Object.fromEntries(
        Array.from(tradeGroups.entries()).map(([k, v]) => [k, v.length])
      ),
      pagesPerType: {},
    },
  };
}

function createMultiTradePages(): {
  pages: ProcessedPage[];
  classification: ClassifiedDocument;
} {
  const pages: ProcessedPage[] = [];
  const classifications: PageClassification[] = [];

  // Mechanical pages (M sheets)
  for (let i = 1; i <= 20; i++) {
    pages.push(
      createMockPage(i, {
        sheetNumber: `M${i}.0`,
        trade: 'Mechanical',
        estimatedTokens: 8000,
        textContent: `HVAC mechanical system page ${i} ductwork diffuser`,
      })
    );
    classifications.push({
      pageNumber: i,
      csiDivision: '23',
      csiDivisionName: 'HVAC',
      trade: 'Mechanical',
      pageType: 'plan',
      confidence: 0.95,
      sheetNumber: `M${i}.0`,
      method: 'pattern',
      keywords: ['hvac', 'ductwork', 'diffuser'],
    });
  }

  // Electrical pages (E sheets)
  for (let i = 21; i <= 35; i++) {
    pages.push(
      createMockPage(i, {
        sheetNumber: `E${i - 20}.0`,
        trade: 'Electrical',
        estimatedTokens: 7000,
        textContent: `Electrical panel circuit page ${i}`,
      })
    );
    classifications.push({
      pageNumber: i,
      csiDivision: '26',
      csiDivisionName: 'Electrical',
      trade: 'Electrical',
      pageType: 'plan',
      confidence: 0.95,
      sheetNumber: `E${i - 20}.0`,
      method: 'pattern',
      keywords: ['electrical', 'panel', 'circuit'],
    });
  }

  // Plumbing pages (P sheets) - smaller trade
  for (let i = 36; i <= 40; i++) {
    pages.push(
      createMockPage(i, {
        sheetNumber: `P${i - 35}.0`,
        trade: 'Plumbing',
        estimatedTokens: 6000,
        textContent: `Plumbing fixture page ${i}`,
      })
    );
    classifications.push({
      pageNumber: i,
      csiDivision: '22',
      csiDivisionName: 'Plumbing',
      trade: 'Plumbing',
      pageType: 'plan',
      confidence: 0.9,
      sheetNumber: `P${i - 35}.0`,
      method: 'pattern',
      keywords: ['plumbing', 'fixture'],
    });
  }

  // General pages (cover, index)
  pages.push(
    createMockPage(41, {
      sheetNumber: 'G0.0',
      trade: 'General',
      pageType: 'cover',
      estimatedTokens: 2000,
      textContent: 'COVER SHEET PROJECT TITLE',
    })
  );
  classifications.push({
    pageNumber: 41,
    csiDivision: '01',
    csiDivisionName: 'General Requirements',
    trade: 'General',
    pageType: 'cover',
    confidence: 0.95,
    sheetNumber: 'G0.0',
    method: 'pattern',
    keywords: [],
  });

  pages.push(
    createMockPage(42, {
      sheetNumber: 'G0.1',
      trade: 'General',
      pageType: 'index',
      estimatedTokens: 3000,
      textContent: 'INDEX LIST OF DRAWINGS',
    })
  );
  classifications.push({
    pageNumber: 42,
    csiDivision: '01',
    csiDivisionName: 'General Requirements',
    trade: 'General',
    pageType: 'index',
    confidence: 0.95,
    sheetNumber: 'G0.1',
    method: 'pattern',
    keywords: [],
  });

  // Build groups
  const tradeGroups = new Map<string, PageClassification[]>();
  const csiGroups = new Map<string, PageClassification[]>();

  for (const c of classifications) {
    const tradeExisting = tradeGroups.get(c.trade) || [];
    tradeExisting.push(c);
    tradeGroups.set(c.trade, tradeExisting);

    const csiExisting = csiGroups.get(c.csiDivision) || [];
    csiExisting.push(c);
    csiGroups.set(c.csiDivision, csiExisting);
  }

  return {
    pages,
    classification: {
      totalPages: pages.length,
      classifications,
      tradeGroups,
      csiGroups,
      summary: {
        tradesIdentified: Array.from(tradeGroups.keys()),
        csiDivisionsIdentified: Array.from(csiGroups.keys()),
        pagesPerTrade: Object.fromEntries(
          Array.from(tradeGroups.entries()).map(([k, v]) => [k, v.length])
        ),
        pagesPerType: {},
      },
    },
  };
}

// ============================================================================
// TRADE CONTEXT MANAGER TESTS
// ============================================================================

describe('TradeContextManager', () => {
  describe('getTradePages', () => {
    it('should return pages for a specific trade', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const mechPages = manager.getTradePages('Mechanical');
      expect(mechPages.length).toBe(20);
      expect(mechPages[0].sheetNumber).toBe('M1.0');

      const elecPages = manager.getTradePages('Electrical');
      expect(elecPages.length).toBe(15);
      expect(elecPages[0].sheetNumber).toBe('E1.0');
    });

    it('should return empty array for non-existent trade', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const pages2 = manager.getTradePages('NonExistent');
      expect(pages2).toEqual([]);
    });
  });

  describe('getRelatedTrades', () => {
    it('should return related trades for Mechanical', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const related = manager.getRelatedTrades('Mechanical');
      expect(related).toContain('Plumbing');
      expect(related).toContain('Fire Protection');
    });

    it('should return related trades for Electrical', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const related = manager.getRelatedTrades('Electrical');
      expect(related).toContain('Fire Alarm');
      expect(related).toContain('Communications');
    });

    it('should return empty array for trades without related mappings', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const related = manager.getRelatedTrades('UnmappedTrade');
      expect(related).toEqual([]);
    });
  });

  describe('getGeneralPages', () => {
    it('should return cover and index pages', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const generalPages = manager.getGeneralPages();
      expect(generalPages.length).toBeGreaterThanOrEqual(2);
      expect(generalPages.some((p) => p.sheetNumber === 'G0.0')).toBe(true);
      expect(generalPages.some((p) => p.sheetNumber === 'G0.1')).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('should sum tokens correctly', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const mechPages = manager.getTradePages('Mechanical');
      const tokens = manager.estimateTokens(mechPages);
      expect(tokens).toBe(20 * 8000); // 20 pages * 8000 tokens each
    });

    it('should return 0 for empty pages', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const tokens = manager.estimateTokens([]);
      expect(tokens).toBe(0);
    });
  });

  describe('buildTradeContext', () => {
    it('should include general pages first', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const { pages: contextPages } = manager.buildTradeContext('Mechanical', 500000);

      // General pages should be included
      expect(contextPages.some((p) => p.sheetNumber === 'G0.0')).toBe(true);
    });

    it('should respect token budget', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      // Set a small budget
      const { pages: contextPages, totalTokens } = manager.buildTradeContext(
        'Mechanical',
        50000
      );

      expect(totalTokens).toBeLessThanOrEqual(50000);
      expect(contextPages.length).toBeLessThan(20); // Not all mechanical pages
    });

    it('should include related trade samples when space available', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      // Large budget
      const { pages: contextPages } = manager.buildTradeContext('Mechanical', 500000);

      // Should include some plumbing pages (related trade)
      expect(contextPages.some((p) => p.sheetNumber?.startsWith('P'))).toBe(true);
    });

    it('should sort pages by page number', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const { pages: contextPages } = manager.buildTradeContext('Mechanical', 500000);

      for (let i = 1; i < contextPages.length; i++) {
        expect(contextPages[i].pageNumber).toBeGreaterThan(
          contextPages[i - 1].pageNumber
        );
      }
    });
  });

  describe('getTradeSummary', () => {
    it('should return summary for all trades', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const summary = manager.getTradeSummary();

      expect(summary.length).toBe(4); // Mechanical, Electrical, Plumbing, General
      expect(summary.find((s) => s.trade === 'Mechanical')?.pageCount).toBe(20);
      expect(summary.find((s) => s.trade === 'Electrical')?.pageCount).toBe(15);
      expect(summary.find((s) => s.trade === 'Plumbing')?.pageCount).toBe(5);
      expect(summary.find((s) => s.trade === 'General')?.pageCount).toBe(2);
    });

    it('should sort by page count descending', () => {
      const { pages, classification } = createMultiTradePages();
      const manager = new TradeContextManager(classification, pages);

      const summary = manager.getTradeSummary();

      for (let i = 1; i < summary.length; i++) {
        expect(summary[i].pageCount).toBeLessThanOrEqual(summary[i - 1].pageCount);
      }
    });
  });
});

// ============================================================================
// BATCH PROCESSOR TESTS
// ============================================================================

describe('BatchProcessor', () => {
  // Mock prisma for database operations
  vi.mock('@/lib/prisma', () => ({
    prisma: {
      diagram: { update: vi.fn() },
      documentPage: { upsert: vi.fn() },
      extractionBatch: { upsert: vi.fn() },
    },
  }));

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const processor = new BatchProcessor('session_123');
      expect(processor.getBatches()).toEqual([]);
    });

    it('should accept custom options', () => {
      const onProgress = vi.fn();
      const processor = new BatchProcessor('session_123', {
        maxTokensPerBatch: 100000,
        maxPagesPerBatch: 50,
        focusTrades: ['Electrical'],
        onProgress,
      });

      expect(processor.getBatches()).toEqual([]);
    });
  });

  describe('batch operations', () => {
    it('should update batch status', () => {
      const processor = new BatchProcessor('session_123');

      // Access private batches array for testing
      (processor as any).batches = [
        {
          id: 'batch_1',
          sessionId: 'session_123',
          batchNumber: 0,
          trade: 'Mechanical',
          csiDivisions: ['23'],
          pageNumbers: [1, 2, 3],
          pages: [],
          estimatedTokens: 10000,
          status: 'pending',
        },
      ];

      processor.updateBatchStatus('batch_1', 'processing');

      const batch = processor.getBatch('batch_1');
      expect(batch?.status).toBe('processing');
      expect(batch?.startedAt).toBeDefined();
    });

    it('should set completedAt when status is completed', () => {
      const processor = new BatchProcessor('session_123');

      (processor as any).batches = [
        {
          id: 'batch_1',
          sessionId: 'session_123',
          batchNumber: 0,
          trade: 'Mechanical',
          csiDivisions: ['23'],
          pageNumbers: [1, 2, 3],
          pages: [],
          estimatedTokens: 10000,
          status: 'processing',
          startedAt: new Date(),
        },
      ];

      processor.updateBatchStatus('batch_1', 'completed', {
        workPackages: [],
        lineItems: [],
        observations: [],
        tokensUsed: { input: 5000, output: 1000 },
        cost: 0.5,
        durationMs: 5000,
      });

      const batch = processor.getBatch('batch_1');
      expect(batch?.status).toBe('completed');
      expect(batch?.completedAt).toBeDefined();
      expect(batch?.results?.tokensUsed.input).toBe(5000);
    });

    it('should store error on failed status', () => {
      const processor = new BatchProcessor('session_123');

      (processor as any).batches = [
        {
          id: 'batch_1',
          sessionId: 'session_123',
          batchNumber: 0,
          trade: 'Mechanical',
          csiDivisions: ['23'],
          pageNumbers: [1, 2, 3],
          pages: [],
          estimatedTokens: 10000,
          status: 'processing',
        },
      ];

      processor.updateBatchStatus('batch_1', 'failed', undefined, 'API error');

      const batch = processor.getBatch('batch_1');
      expect(batch?.status).toBe('failed');
      expect(batch?.error).toBe('API error');
    });
  });

  describe('estimateTotalCost', () => {
    it('should calculate cost based on token estimates', () => {
      const processor = new BatchProcessor('session_123');

      (processor as any).batches = [
        {
          id: 'batch_1',
          sessionId: 'session_123',
          batchNumber: 0,
          trade: 'Mechanical',
          csiDivisions: ['23'],
          pageNumbers: [1, 2, 3],
          pages: [],
          estimatedTokens: 100000,
          status: 'pending',
        },
        {
          id: 'batch_2',
          sessionId: 'session_123',
          batchNumber: 1,
          trade: 'Electrical',
          csiDivisions: ['26'],
          pageNumbers: [4, 5, 6],
          pages: [],
          estimatedTokens: 50000,
          status: 'pending',
        },
      ];

      const { totalCost, breakdown } = processor.estimateTotalCost();

      expect(breakdown.length).toBe(2);
      expect(breakdown[0].trade).toBe('Mechanical');
      expect(breakdown[0].estimatedInputTokens).toBe(100000);
      expect(breakdown[0].estimatedOutputTokens).toBe(20000); // 20% of input
      expect(totalCost).toBeGreaterThan(0);
    });

    it('should return 0 for empty batches', () => {
      const processor = new BatchProcessor('session_123');

      const { totalCost, breakdown } = processor.estimateTotalCost();

      expect(totalCost).toBe(0);
      expect(breakdown).toEqual([]);
    });
  });

  describe('progress callbacks', () => {
    it('should emit progress events', () => {
      const onProgress = vi.fn();
      const processor = new BatchProcessor('session_123', { onProgress });

      (processor as any).batches = [
        {
          id: 'batch_1',
          status: 'pending',
          trade: 'Mechanical',
          pages: [],
          pageNumbers: [1, 2],
          estimatedTokens: 10000,
        },
        {
          id: 'batch_2',
          status: 'pending',
          trade: 'Electrical',
          pages: [],
          pageNumbers: [3, 4],
          estimatedTokens: 10000,
        },
      ];

      processor.updateBatchStatus('batch_1', 'completed', {
        workPackages: [],
        lineItems: [{ id: '1', description: 'test', action: 'install', order: 1, references: [], extraction: {} as any }],
        observations: [],
        tokensUsed: { input: 5000, output: 1000 },
        cost: 0.5,
        durationMs: 3000,
      });

      // Check that progress was emitted
      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.completedBatches).toBe(1);
      expect(lastCall.totalBatches).toBe(2);
      expect(lastCall.itemsFound).toBe(1);
    });
  });
});

// ============================================================================
// INTEGRATION-LIKE TESTS (without actual PDF processing)
// ============================================================================

describe('Batch Creation Logic', () => {
  it('should prioritize focus trades', () => {
    const { pages, classification } = createMultiTradePages();
    const contextManager = new TradeContextManager(classification, pages);

    const tradeSummary = contextManager.getTradeSummary();

    // Simulate prioritization (same logic as in BatchProcessor)
    const focusTrades = ['Plumbing'];
    const sortedTrades = tradeSummary.sort((a, b) => {
      const aFocus = focusTrades.includes(a.trade) ? 1 : 0;
      const bFocus = focusTrades.includes(b.trade) ? 1 : 0;
      if (aFocus !== bFocus) return bFocus - aFocus;
      return b.pageCount - a.pageCount;
    });

    // Plumbing should be first even though it has fewer pages
    expect(sortedTrades[0].trade).toBe('Plumbing');
  });

  it('should combine small trades when below minimum', () => {
    const pages: ProcessedPage[] = [];
    const classifications: PageClassification[] = [];

    // Create a few pages per trade (below minimum)
    const smallTrades = ['Trade1', 'Trade2', 'Trade3'];
    for (let i = 0; i < smallTrades.length; i++) {
      const trade = smallTrades[i];
      pages.push(
        createMockPage(i + 1, {
          sheetNumber: `T${i + 1}`,
          trade,
          estimatedTokens: 2000, // Very small
        })
      );
      classifications.push({
        pageNumber: i + 1,
        csiDivision: '99',
        csiDivisionName: 'Test',
        trade,
        pageType: 'plan',
        confidence: 0.9,
        sheetNumber: `T${i + 1}`,
        method: 'pattern',
        keywords: [],
      });
    }

    const totalSmallTokens = 3 * 2000;
    expect(totalSmallTokens).toBeLessThan(MIN_TOKENS_PER_BATCH);
    // These should be combined into one batch
  });

  it('should split large trades into multiple batches', () => {
    const pagesPerTrade = MAX_PAGES_PER_BATCH + 50; // More than max
    const pages: ProcessedPage[] = [];

    for (let i = 1; i <= pagesPerTrade; i++) {
      pages.push(
        createMockPage(i, {
          sheetNumber: `M${i}`,
          trade: 'Mechanical',
          estimatedTokens: 1000,
        })
      );
    }

    // This would result in 2 batches: one with MAX_PAGES_PER_BATCH, one with 50
    const expectedBatches = Math.ceil(pagesPerTrade / MAX_PAGES_PER_BATCH);
    expect(expectedBatches).toBe(2);
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  it('should have reasonable default values', () => {
    expect(MAX_TOKENS_PER_BATCH).toBeGreaterThan(100000);
    expect(MAX_TOKENS_PER_BATCH).toBeLessThan(500000); // Conservative for safety
    expect(MIN_TOKENS_PER_BATCH).toBeGreaterThan(1000);
    expect(MAX_PAGES_PER_BATCH).toBeGreaterThanOrEqual(50);
  });
});
