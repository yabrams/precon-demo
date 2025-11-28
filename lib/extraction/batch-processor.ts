/**
 * Batch Processor for Large Document Support
 *
 * Processes large documents by breaking them into trade-based batches,
 * managing context windows, and coordinating extraction across pages.
 *
 * Key features:
 * - Trade-based page grouping for focused extraction
 * - Token budget management for LLM context limits
 * - Parallel batch processing with progress tracking
 * - Cost estimation and tracking per batch
 */

import { prisma } from '@/lib/prisma';
import {
  ProcessedPage,
  PDFPageMetadata,
  splitPDFToPages,
} from '@/lib/pdf-utils';
import {
  classifyDocument,
  ClassifiedDocument,
  PageClassification,
  getPagesByTrade,
  estimateTradeTokens,
} from './page-classifier';
import {
  ExtractionDocument,
  ExtractedWorkPackage,
  ExtractedLineItem,
  AIObservation,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum tokens per batch to stay within LLM context limits.
 * Using conservative limit to leave room for prompts and output.
 * Gemini 2.5 Pro: 1M context, but we'll use 200K per batch for safety
 */
export const MAX_TOKENS_PER_BATCH = 200_000;

/**
 * Minimum tokens per batch - if a trade has fewer, combine with related trades
 */
export const MIN_TOKENS_PER_BATCH = 10_000;

/**
 * Maximum pages per batch for performance
 */
export const MAX_PAGES_PER_BATCH = 100;

/**
 * Concurrent batch processing limit
 */
export const MAX_CONCURRENT_BATCHES = 2;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * A batch of pages to be processed together
 */
export interface ExtractionBatch {
  /** Unique batch identifier */
  id: string;

  /** Session this batch belongs to */
  sessionId: string;

  /** Batch number within the session */
  batchNumber: number;

  /** Primary trade for this batch */
  trade: string;

  /** CSI divisions included */
  csiDivisions: string[];

  /** Page numbers included in this batch */
  pageNumbers: number[];

  /** Page data for extraction */
  pages: ProcessedPage[];

  /** Estimated tokens for this batch */
  estimatedTokens: number;

  /** Status of the batch */
  status: BatchStatus;

  /** Results after processing */
  results?: BatchResults;

  /** Error if failed */
  error?: string;

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
}

export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Results from processing a batch
 */
export interface BatchResults {
  /** Work packages extracted */
  workPackages: ExtractedWorkPackage[];

  /** Line items extracted */
  lineItems: ExtractedLineItem[];

  /** Observations generated */
  observations: AIObservation[];

  /** Tokens used */
  tokensUsed: {
    input: number;
    output: number;
  };

  /** Cost of this batch */
  cost: number;

  /** Processing time in ms */
  durationMs: number;
}

/**
 * Options for batch processing
 */
export interface BatchProcessorOptions {
  /** Maximum tokens per batch */
  maxTokensPerBatch?: number;

  /** Maximum pages per batch */
  maxPagesPerBatch?: number;

  /** Concurrent batch limit */
  maxConcurrentBatches?: number;

  /** Trades to focus on (process first) */
  focusTrades?: string[];

  /** Trades to skip */
  skipTrades?: string[];

  /** Progress callback */
  onProgress?: (event: BatchProgressEvent) => void;

  /** Batch complete callback */
  onBatchComplete?: (batch: ExtractionBatch) => void;
}

/**
 * Progress event during batch processing
 */
export interface BatchProgressEvent {
  /** Total batches */
  totalBatches: number;

  /** Completed batches */
  completedBatches: number;

  /** Current batch being processed */
  currentBatch?: number;

  /** Overall progress percentage */
  progress: number;

  /** Status message */
  message: string;

  /** Items found so far */
  itemsFound: number;

  /** Observations so far */
  observationsFound: number;
}

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  /** Document ID */
  documentId: string;

  /** Total pages in document */
  totalPages: number;

  /** Pages successfully processed */
  processedPages: number;

  /** Classification results */
  classification: ClassifiedDocument;

  /** Batches created */
  batches: ExtractionBatch[];

  /** Any errors during processing */
  errors: string[];
}

// ============================================================================
// TRADE CONTEXT MANAGER
// ============================================================================

/**
 * Manages context assembly for trade-based extraction.
 * Groups related pages and ensures relevant context is available.
 */
export class TradeContextManager {
  private classification: ClassifiedDocument;
  private pages: ProcessedPage[];
  private pageMap: Map<number, ProcessedPage>;

  constructor(classification: ClassifiedDocument, pages: ProcessedPage[]) {
    this.classification = classification;
    this.pages = pages;
    this.pageMap = new Map(pages.map((p) => [p.pageNumber, p]));
  }

  /**
   * Get pages for a specific trade
   */
  getTradePages(trade: string): ProcessedPage[] {
    const classifications = getPagesByTrade(this.classification, trade);
    return classifications
      .map((c) => this.pageMap.get(c.pageNumber))
      .filter((p): p is ProcessedPage => p !== undefined);
  }

  /**
   * Get related trades that should be processed together.
   * For example, Electrical and Fire Alarm often have dependencies.
   */
  getRelatedTrades(trade: string): string[] {
    const relatedMap: Record<string, string[]> = {
      Mechanical: ['Plumbing', 'Fire Protection'],
      Electrical: ['Fire Alarm', 'Communications'],
      Plumbing: ['Mechanical', 'Fire Protection'],
      'Fire Protection': ['Plumbing', 'Fire Alarm'],
      'Fire Alarm': ['Electrical', 'Fire Protection'],
      Structural: ['Architectural'],
      Architectural: ['Structural', 'Interiors'],
    };

    return relatedMap[trade] || [];
  }

  /**
   * Get general pages that should be included with every trade.
   * These include cover sheets, legends, general notes, etc.
   */
  getGeneralPages(): ProcessedPage[] {
    const generalTypes = ['cover', 'index', 'legend', 'general_notes'];
    const generalClassifications = this.classification.classifications.filter(
      (c) =>
        c.trade === 'General' ||
        generalTypes.includes(c.pageType)
    );
    return generalClassifications
      .map((c) => this.pageMap.get(c.pageNumber))
      .filter((p): p is ProcessedPage => p !== undefined);
  }

  /**
   * Get index/cover pages for reference
   */
  getIndexPages(): ProcessedPage[] {
    return this.classification.classifications
      .filter((c) => c.pageType === 'cover' || c.pageType === 'index')
      .map((c) => this.pageMap.get(c.pageNumber))
      .filter((p): p is ProcessedPage => p !== undefined);
  }

  /**
   * Estimate tokens for a set of pages
   */
  estimateTokens(pages: ProcessedPage[]): number {
    return pages.reduce((sum, p) => sum + p.estimatedTokens, 0);
  }

  /**
   * Build optimal context for a trade within token budget.
   * Includes trade pages, general pages, and related trade samples.
   */
  buildTradeContext(
    trade: string,
    maxTokens: number
  ): { pages: ProcessedPage[]; totalTokens: number } {
    const result: ProcessedPage[] = [];
    let totalTokens = 0;

    // Always include general pages first (they provide context)
    const generalPages = this.getGeneralPages();
    for (const page of generalPages) {
      if (totalTokens + page.estimatedTokens <= maxTokens) {
        result.push(page);
        totalTokens += page.estimatedTokens;
      }
    }

    // Add all trade-specific pages
    const tradePages = this.getTradePages(trade);
    for (const page of tradePages) {
      if (totalTokens + page.estimatedTokens <= maxTokens) {
        result.push(page);
        totalTokens += page.estimatedTokens;
      }
    }

    // If we have room, add samples from related trades for coordination
    if (totalTokens < maxTokens * 0.8) {
      const relatedTrades = this.getRelatedTrades(trade);
      for (const relatedTrade of relatedTrades) {
        const relatedPages = this.getTradePages(relatedTrade);
        // Just add first few pages as reference
        for (const page of relatedPages.slice(0, 3)) {
          if (totalTokens + page.estimatedTokens <= maxTokens) {
            result.push(page);
            totalTokens += page.estimatedTokens;
          }
        }
      }
    }

    // Sort by page number for coherent context
    result.sort((a, b) => a.pageNumber - b.pageNumber);

    return { pages: result, totalTokens };
  }

  /**
   * Get summary of all trades and their page counts
   */
  getTradeSummary(): { trade: string; pageCount: number; tokens: number }[] {
    const summary: { trade: string; pageCount: number; tokens: number }[] = [];

    for (const [trade, pages] of this.classification.tradeGroups) {
      const tradePages = this.getTradePages(trade);
      summary.push({
        trade,
        pageCount: pages.length,
        tokens: this.estimateTokens(tradePages),
      });
    }

    return summary.sort((a, b) => b.pageCount - a.pageCount);
  }
}

// ============================================================================
// BATCH PROCESSOR
// ============================================================================

/**
 * Processes large documents by creating and managing extraction batches.
 */
export class BatchProcessor {
  private options: Required<BatchProcessorOptions>;
  private batches: ExtractionBatch[] = [];
  private sessionId: string;

  constructor(sessionId: string, options: BatchProcessorOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      maxTokensPerBatch: options.maxTokensPerBatch ?? MAX_TOKENS_PER_BATCH,
      maxPagesPerBatch: options.maxPagesPerBatch ?? MAX_PAGES_PER_BATCH,
      maxConcurrentBatches: options.maxConcurrentBatches ?? MAX_CONCURRENT_BATCHES,
      focusTrades: options.focusTrades ?? [],
      skipTrades: options.skipTrades ?? [],
      onProgress: options.onProgress ?? (() => {}),
      onBatchComplete: options.onBatchComplete ?? (() => {}),
    };
  }

  /**
   * Process a document: split into pages, classify, and create batches
   */
  async processDocument(
    document: ExtractionDocument,
    pdfBuffer: Buffer
  ): Promise<DocumentProcessingResult> {
    const errors: string[] = [];

    // Split PDF into pages
    this.emitProgress({
      totalBatches: 0,
      completedBatches: 0,
      progress: 5,
      message: `Splitting ${document.name} into pages...`,
      itemsFound: 0,
      observationsFound: 0,
    });

    const { pages, totalPages, processedPages } = await splitPDFToPages(pdfBuffer, {
      startPage: 1,
      maxPages: undefined, // Process all pages
      generateThumbnails: true,
      parallelism: 5,
    });

    if (processedPages < totalPages) {
      errors.push(
        `Only processed ${processedPages} of ${totalPages} pages`
      );
    }

    // Classify all pages
    this.emitProgress({
      totalBatches: 0,
      completedBatches: 0,
      progress: 15,
      message: 'Classifying pages by trade...',
      itemsFound: 0,
      observationsFound: 0,
    });

    const classification = classifyDocument(pages);

    console.log(
      `Document classified: ${classification.summary.tradesIdentified.length} trades, ` +
        `${totalPages} pages`
    );
    console.log('Trades:', classification.summary.tradesIdentified.join(', '));
    console.log(
      'Pages per trade:',
      JSON.stringify(classification.summary.pagesPerTrade)
    );

    // Create batches
    const contextManager = new TradeContextManager(classification, pages);
    const batches = this.createBatches(contextManager, classification);

    // Store pages in database
    await this.persistPages(document.id, pages, classification);

    return {
      documentId: document.id,
      totalPages,
      processedPages,
      classification,
      batches,
      errors,
    };
  }

  /**
   * Create batches from classified pages
   */
  private createBatches(
    contextManager: TradeContextManager,
    classification: ClassifiedDocument
  ): ExtractionBatch[] {
    const batches: ExtractionBatch[] = [];
    let batchNumber = 0;

    // Get trades sorted by priority (focus trades first, then by page count)
    const tradeSummary = contextManager.getTradeSummary();
    const sortedTrades = this.sortTradesByPriority(tradeSummary);

    // Skip specified trades
    const tradesToProcess = sortedTrades.filter(
      (t) => !this.options.skipTrades.includes(t.trade)
    );

    // Create a batch for each trade (or combine small trades)
    let pendingSmallTrades: typeof tradeSummary = [];

    for (const tradeInfo of tradesToProcess) {
      // Skip very small trades, collect them for later
      if (tradeInfo.tokens < MIN_TOKENS_PER_BATCH) {
        pendingSmallTrades.push(tradeInfo);
        continue;
      }

      // Build context for this trade
      const { pages, totalTokens } = contextManager.buildTradeContext(
        tradeInfo.trade,
        this.options.maxTokensPerBatch
      );

      // If trade is too large, split into multiple batches
      if (pages.length > this.options.maxPagesPerBatch) {
        const tradeBatches = this.splitLargeTrade(
          tradeInfo.trade,
          pages,
          classification
        );
        batches.push(...tradeBatches.map((b) => ({ ...b, batchNumber: batchNumber++ })));
      } else {
        batches.push(
          this.createBatch(
            batchNumber++,
            tradeInfo.trade,
            pages,
            classification
          )
        );
      }
    }

    // Combine remaining small trades into one batch
    if (pendingSmallTrades.length > 0) {
      const combinedPages: ProcessedPage[] = [];
      const combinedCsiDivisions = new Set<string>();

      for (const tradeInfo of pendingSmallTrades) {
        const tradePages = contextManager.getTradePages(tradeInfo.trade);
        combinedPages.push(...tradePages);
        const tradeClassifications = getPagesByTrade(
          classification,
          tradeInfo.trade
        );
        for (const c of tradeClassifications) {
          combinedCsiDivisions.add(c.csiDivision);
        }
      }

      if (combinedPages.length > 0) {
        batches.push({
          id: this.generateId(),
          sessionId: this.sessionId,
          batchNumber: batchNumber++,
          trade: 'Mixed (Small Trades)',
          csiDivisions: Array.from(combinedCsiDivisions),
          pageNumbers: combinedPages.map((p) => p.pageNumber),
          pages: combinedPages,
          estimatedTokens: combinedPages.reduce(
            (sum, p) => sum + p.estimatedTokens,
            0
          ),
          status: 'pending',
        });
      }
    }

    this.batches = batches;
    return batches;
  }

  /**
   * Sort trades by priority for processing order
   */
  private sortTradesByPriority(
    tradeSummary: { trade: string; pageCount: number; tokens: number }[]
  ): typeof tradeSummary {
    return tradeSummary.sort((a, b) => {
      // Focus trades come first
      const aFocus = this.options.focusTrades.includes(a.trade) ? 1 : 0;
      const bFocus = this.options.focusTrades.includes(b.trade) ? 1 : 0;
      if (aFocus !== bFocus) return bFocus - aFocus;

      // Then by page count (larger trades first - they're usually more important)
      return b.pageCount - a.pageCount;
    });
  }

  /**
   * Split a large trade into multiple batches
   */
  private splitLargeTrade(
    trade: string,
    pages: ProcessedPage[],
    classification: ClassifiedDocument
  ): ExtractionBatch[] {
    const batches: ExtractionBatch[] = [];
    const maxPages = this.options.maxPagesPerBatch;

    for (let i = 0; i < pages.length; i += maxPages) {
      const batchPages = pages.slice(i, i + maxPages);
      const csiDivisions = new Set<string>();

      for (const page of batchPages) {
        const pageClass = classification.classifications.find(
          (c) => c.pageNumber === page.pageNumber
        );
        if (pageClass) {
          csiDivisions.add(pageClass.csiDivision);
        }
      }

      batches.push({
        id: this.generateId(),
        sessionId: this.sessionId,
        batchNumber: 0, // Will be set by caller
        trade: `${trade} (Part ${batches.length + 1})`,
        csiDivisions: Array.from(csiDivisions),
        pageNumbers: batchPages.map((p) => p.pageNumber),
        pages: batchPages,
        estimatedTokens: batchPages.reduce(
          (sum, p) => sum + p.estimatedTokens,
          0
        ),
        status: 'pending',
      });
    }

    return batches;
  }

  /**
   * Create a single batch
   */
  private createBatch(
    batchNumber: number,
    trade: string,
    pages: ProcessedPage[],
    classification: ClassifiedDocument
  ): ExtractionBatch {
    const csiDivisions = new Set<string>();
    for (const page of pages) {
      const pageClass = classification.classifications.find(
        (c) => c.pageNumber === page.pageNumber
      );
      if (pageClass) {
        csiDivisions.add(pageClass.csiDivision);
      }
    }

    return {
      id: this.generateId(),
      sessionId: this.sessionId,
      batchNumber,
      trade,
      csiDivisions: Array.from(csiDivisions),
      pageNumbers: pages.map((p) => p.pageNumber),
      pages,
      estimatedTokens: pages.reduce((sum, p) => sum + p.estimatedTokens, 0),
      status: 'pending',
    };
  }

  /**
   * Persist pages to database
   */
  private async persistPages(
    diagramId: string,
    pages: ProcessedPage[],
    classification: ClassifiedDocument
  ): Promise<void> {
    try {
      // Update diagram with page count
      await prisma.diagram.update({
        where: { id: diagramId },
        data: {
          pageCount: pages.length,
          processedPages: pages.length,
          processingStatus: 'classified',
        },
      });

      // Create page records
      for (const page of pages) {
        const pageClass = classification.classifications.find(
          (c) => c.pageNumber === page.pageNumber
        );

        await prisma.documentPage.upsert({
          where: {
            diagramId_pageNumber: {
              diagramId,
              pageNumber: page.pageNumber,
            },
          },
          create: {
            diagramId,
            pageNumber: page.pageNumber,
            sheetNumber: page.sheetNumber,
            csiDivision: pageClass?.csiDivision,
            trade: pageClass?.trade,
            pageType: page.estimatedType,
            classificationConfidence: pageClass?.confidence ?? 0,
            classificationMethod: pageClass?.method,
            imageUrl: '', // Will be set when images are uploaded
            textContent: page.textContent,
            textPreview: page.textPreview,
            width: page.width,
            height: page.height,
            estimatedTokens: page.estimatedTokens,
            processedAt: new Date(),
          },
          update: {
            sheetNumber: page.sheetNumber,
            csiDivision: pageClass?.csiDivision,
            trade: pageClass?.trade,
            pageType: page.estimatedType,
            classificationConfidence: pageClass?.confidence ?? 0,
            classificationMethod: pageClass?.method,
            textContent: page.textContent,
            textPreview: page.textPreview,
            estimatedTokens: page.estimatedTokens,
            processedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to persist pages:', error);
      // Don't throw - we can continue without persistence
    }
  }

  /**
   * Persist batch to database
   */
  async persistBatch(batch: ExtractionBatch): Promise<void> {
    try {
      await prisma.extractionBatch.upsert({
        where: { id: batch.id },
        create: {
          id: batch.id,
          sessionId: batch.sessionId,
          batchNumber: batch.batchNumber,
          trade: batch.trade,
          pageNumbers: JSON.stringify(batch.pageNumbers),
          pageCount: batch.pageNumbers.length,
          status: batch.status,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          itemsFound: batch.results?.lineItems.length ?? 0,
          observationsFound: batch.results?.observations.length ?? 0,
          tokensUsed: batch.results
            ? JSON.stringify(batch.results.tokensUsed)
            : null,
          cost: batch.results?.cost,
          error: batch.error,
        },
        update: {
          status: batch.status,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          itemsFound: batch.results?.lineItems.length ?? 0,
          observationsFound: batch.results?.observations.length ?? 0,
          tokensUsed: batch.results
            ? JSON.stringify(batch.results.tokensUsed)
            : null,
          cost: batch.results?.cost,
          error: batch.error,
        },
      });
    } catch (error) {
      console.error('Failed to persist batch:', error);
    }
  }

  /**
   * Get batches
   */
  getBatches(): ExtractionBatch[] {
    return this.batches;
  }

  /**
   * Get batch by ID
   */
  getBatch(id: string): ExtractionBatch | undefined {
    return this.batches.find((b) => b.id === id);
  }

  /**
   * Update batch status
   */
  updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    results?: BatchResults,
    error?: string
  ): void {
    const batch = this.batches.find((b) => b.id === batchId);
    if (batch) {
      batch.status = status;
      if (status === 'processing') {
        batch.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        batch.completedAt = new Date();
      }
      if (results) {
        batch.results = results;
      }
      if (error) {
        batch.error = error;
      }

      // Persist update
      this.persistBatch(batch);

      // Emit progress
      this.emitProgressUpdate();
    }
  }

  /**
   * Emit progress update
   */
  private emitProgressUpdate(): void {
    const completed = this.batches.filter((b) => b.status === 'completed').length;
    const total = this.batches.length;
    const itemsFound = this.batches.reduce(
      (sum, b) => sum + (b.results?.lineItems.length ?? 0),
      0
    );
    const observationsFound = this.batches.reduce(
      (sum, b) => sum + (b.results?.observations.length ?? 0),
      0
    );

    const currentBatch = this.batches.find((b) => b.status === 'processing');

    this.emitProgress({
      totalBatches: total,
      completedBatches: completed,
      currentBatch: currentBatch?.batchNumber,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      message: currentBatch
        ? `Processing ${currentBatch.trade} (${currentBatch.pages.length} pages)...`
        : completed === total
          ? 'All batches completed'
          : 'Waiting...',
      itemsFound,
      observationsFound,
    });
  }

  /**
   * Emit progress event
   */
  private emitProgress(event: BatchProgressEvent): void {
    this.options.onProgress(event);
  }

  /**
   * Estimate total cost for all batches
   */
  estimateTotalCost(): { totalCost: number; breakdown: BatchCostBreakdown[] } {
    const breakdown: BatchCostBreakdown[] = [];
    let totalCost = 0;

    for (const batch of this.batches) {
      // Estimate tokens: ~2000 tokens per page for images
      const inputTokens = batch.estimatedTokens;
      // Estimate output at 20% of input
      const outputTokens = Math.round(inputTokens * 0.2);

      // Gemini pricing: $1.25 per 1M input, $10 per 1M output
      const cost =
        (inputTokens * 1.25 + outputTokens * 10.0) / 1_000_000;

      breakdown.push({
        batchId: batch.id,
        trade: batch.trade,
        pages: batch.pageNumbers.length,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedCost: Math.round(cost * 100) / 100,
      });

      totalCost += cost;
    }

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `batch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Cost breakdown per batch
 */
export interface BatchCostBreakdown {
  batchId: string;
  trade: string;
  pages: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Process multiple documents and create unified batches
 */
export async function processDocuments(
  sessionId: string,
  documents: Array<{ document: ExtractionDocument; buffer: Buffer }>,
  options?: BatchProcessorOptions
): Promise<{
  processor: BatchProcessor;
  results: DocumentProcessingResult[];
  totalBatches: number;
  estimatedCost: number;
}> {
  const processor = new BatchProcessor(sessionId, options);
  const results: DocumentProcessingResult[] = [];

  for (const { document, buffer } of documents) {
    const result = await processor.processDocument(document, buffer);
    results.push(result);
  }

  const costEstimate = processor.estimateTotalCost();

  return {
    processor,
    results,
    totalBatches: processor.getBatches().length,
    estimatedCost: costEstimate.totalCost,
  };
}
