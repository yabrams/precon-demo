/**
 * Extraction API - Public Interface
 *
 * This module provides a clean, well-documented API for the extraction system.
 * It abstracts the underlying orchestration complexity and provides two modes:
 *
 * - **Standard Mode**: Fast 3-pass extraction (Extract → Review → Validate)
 * - **Comprehensive Mode**: Full 5-pass extraction for maximum coverage
 *
 * @example
 * ```typescript
 * import { ExtractionService, ExtractionMode } from '@/lib/extraction';
 *
 * // Quick extraction with standard mode
 * const result = await ExtractionService.extract({
 *   projectId: 'proj-123',
 *   documents: [{ id: 'doc-1', url: '/path/to/doc.pdf', ... }],
 *   mode: ExtractionMode.Standard,
 * });
 *
 * // Monitor progress with callbacks
 * const result = await ExtractionService.extract({
 *   projectId: 'proj-123',
 *   documents: [...],
 *   mode: ExtractionMode.Comprehensive,
 *   onProgress: (event) => console.log(event.status, event.progress),
 * });
 * ```
 *
 * @module extraction
 */

// Re-export core types for consumers
export {
  // Document types
  type ExtractionDocument,
  type DocumentType,
  type DocumentReference,
  type DocumentLocation,
  type BoundingBox,

  // Extracted data types
  type ExtractedWorkPackage,
  type ExtractedLineItem,
  type AIObservation,

  // Metadata types
  type ConfidenceScore,
  type ConfidenceFlag,
  type CSIClassification,
  type ExtractionMetadata,

  // Session types
  type ExtractionSession,
  type ExtractionMetrics,
  type ExtractionPass,
  type ExtractionStatus,

  // Observation types
  type ObservationSeverity,
  type ObservationCategory,

  // Model types
  type ModelIdentifier,
  MODEL_CONFIGS,
  MODEL_PRICING,
} from './types';

// ============================================================================
// EXTRACTION MODE
// ============================================================================

/**
 * Extraction mode determines the depth and thoroughness of the extraction.
 *
 * - **Standard**: 3-pass extraction optimized for speed and cost
 * - **Comprehensive**: Full 5-pass extraction for maximum coverage
 */
export enum ExtractionMode {
  /**
   * Standard 3-pass extraction (recommended for most use cases)
   *
   * Pass 1: Initial extraction with primary model (Gemini)
   * Pass 2: Self-review to find missed items
   * Pass 3: Cross-model validation (Claude)
   *
   * Typical cost: ~$0.65 per extraction
   * Typical duration: 2-4 minutes
   * Expected coverage: ~95% of items
   */
  Standard = 'standard',

  /**
   * Comprehensive 5-pass extraction for maximum coverage
   *
   * Pass 1: Initial extraction with primary model (Gemini)
   * Pass 2: Self-review to find missed items
   * Pass 3: Trade-specific deep dive
   * Pass 4: Cross-model validation (Claude)
   * Pass 5: Final validation and quality check
   *
   * Typical cost: ~$1.10 per extraction
   * Typical duration: 5-8 minutes
   * Expected coverage: ~99% of items
   */
  Comprehensive = 'comprehensive',
}

// ============================================================================
// API INTERFACES
// ============================================================================

/**
 * Input document for extraction
 */
export interface ExtractionInput {
  /** Unique document identifier */
  id: string;
  /** Display name of the document */
  name: string;
  /** URL or file path to the document */
  url: string;
  /** Document type classification */
  type: import('./types').DocumentType;
  /** MIME type (e.g., 'application/pdf') */
  mimeType: string;
  /** Number of pages (optional, will be detected if not provided) */
  pageCount?: number;
}

/**
 * Options for configuring the extraction
 */
export interface ExtractionOptions {
  /** Project ID to associate the extraction with */
  projectId: string;

  /** Documents to extract from */
  documents: ExtractionInput[];

  /** Extraction mode - Standard (fast) or Comprehensive (thorough) */
  mode?: ExtractionMode;

  /**
   * Optional callback for progress updates
   * Called whenever extraction state changes
   */
  onProgress?: (event: ExtractionProgressEvent) => void;

  /**
   * Optional trades to focus extraction on
   * If provided, extraction will prioritize these trades
   */
  focusTrades?: string[];

  /**
   * Optional trades to skip during extraction
   * Use when certain trades are known to be out of scope
   */
  skipTrades?: string[];

  /**
   * Minimum confidence threshold (0-1)
   * Items below this threshold will be flagged for review
   * @default 0.5
   */
  minimumConfidence?: number;

  /**
   * Override the primary extraction model
   * @default 'gemini-2.5-pro'
   */
  primaryModel?: import('./types').ModelIdentifier;

  /**
   * Override the validation model
   * @default 'claude-sonnet-4.5'
   */
  validationModel?: import('./types').ModelIdentifier;
}

/**
 * Progress event emitted during extraction
 */
export interface ExtractionProgressEvent {
  /** Current status */
  status: import('./types').ExtractionStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current pass number (1-5) */
  currentPass: number;

  /** Total passes for this mode */
  totalPasses: number;

  /** Human-readable status message */
  message: string;

  /** Items found so far */
  itemsFound: number;

  /** Observations generated so far */
  observationsFound: number;

  /** Timestamp of this event */
  timestamp: Date;
}

/**
 * Result of a successful extraction
 */
export interface ExtractionResult {
  /** Whether the extraction completed successfully */
  success: true;

  /** The complete extraction session with all data */
  session: import('./types').ExtractionSession;

  /** Quick access to extracted work packages */
  workPackages: import('./types').ExtractedWorkPackage[];

  /** Quick access to AI observations */
  observations: import('./types').AIObservation[];

  /** Summary metrics */
  summary: ExtractionSummary;
}

/**
 * Result of a failed extraction
 */
export interface ExtractionError {
  /** Indicates failure */
  success: false;

  /** Error code for programmatic handling */
  code: ExtractionErrorCode;

  /** Human-readable error message */
  message: string;

  /** The pass where the error occurred (if applicable) */
  failedAtPass?: number;

  /** Partial results if any extraction completed before failure */
  partialSession?: import('./types').ExtractionSession;
}

/**
 * Error codes for extraction failures
 */
export enum ExtractionErrorCode {
  /** No documents provided */
  NO_DOCUMENTS = 'NO_DOCUMENTS',

  /** Document could not be read or parsed */
  DOCUMENT_READ_ERROR = 'DOCUMENT_READ_ERROR',

  /** API key missing or invalid */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  /** API rate limit exceeded */
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  /** Model returned invalid response */
  MODEL_RESPONSE_ERROR = 'MODEL_RESPONSE_ERROR',

  /** Extraction timed out */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  /** Unknown or unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Summary of extraction results
 */
export interface ExtractionSummary {
  /** Total work packages extracted */
  totalWorkPackages: number;

  /** Total line items extracted */
  totalLineItems: number;

  /** Total observations generated */
  totalObservations: number;

  /** Number of critical observations */
  criticalObservations: number;

  /** Number of items flagged for review */
  itemsNeedingReview: number;

  /** CSI divisions covered */
  csiDivisionsCovered: string[];

  /** Overall confidence score (0-1) */
  averageConfidence: number;

  /** Total extraction time in milliseconds */
  durationMs: number;

  /** Estimated cost of extraction */
  estimatedCost: number;

  /** Number of passes completed */
  passesCompleted: number;

  /** Cache hits during extraction */
  cacheHits: number;
}

/**
 * Cost breakdown details
 */
export interface CostBreakdown {
  totalPages: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  geminiPasses: number;
  claudePasses: number;
  geminiCost: number;
  claudeCost: number;
}

// ============================================================================
// EXTRACTION SERVICE
// ============================================================================

import { ExtractionOrchestrator } from './orchestrator';
import {
  ExtractionConfig,
  DEFAULT_EXTRACTION_CONFIG,
  ExtractionDocument,
} from './types';

/**
 * Main extraction service providing a clean API for document extraction.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await ExtractionService.extract({
 *   projectId: 'project-123',
 *   documents: [
 *     { id: 'doc-1', name: 'Plans.pdf', url: '/uploads/plans.pdf', type: 'design_drawings', mimeType: 'application/pdf' }
 *   ],
 *   mode: ExtractionMode.Standard,
 * });
 *
 * if (result.success) {
 *   console.log(`Found ${result.summary.totalLineItems} items`);
 * }
 * ```
 */
export class ExtractionService {
  /**
   * Extract work packages and line items from construction documents.
   *
   * @param options - Extraction configuration options
   * @returns Extraction result with work packages, observations, and summary
   *
   * @example
   * ```typescript
   * const result = await ExtractionService.extract({
   *   projectId: 'proj-123',
   *   documents: [...],
   *   mode: ExtractionMode.Comprehensive,
   *   onProgress: (event) => {
   *     console.log(`Pass ${event.currentPass}/${event.totalPasses}: ${event.message}`);
   *   },
   * });
   * ```
   */
  static async extract(
    options: ExtractionOptions
  ): Promise<ExtractionResult | ExtractionError> {
    const startTime = Date.now();

    // Validate inputs
    if (!options.documents || options.documents.length === 0) {
      return {
        success: false,
        code: ExtractionErrorCode.NO_DOCUMENTS,
        message: 'At least one document is required for extraction',
      };
    }

    // Determine mode and configure
    const mode = options.mode ?? ExtractionMode.Standard;
    const config = ExtractionService.buildConfig(options, mode);

    // Convert input documents to internal format
    const documents: ExtractionDocument[] = options.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      url: doc.url,
      type: doc.type,
      mimeType: doc.mimeType,
      pageCount: doc.pageCount,
    }));

    try {
      // Create orchestrator
      const orchestrator = new ExtractionOrchestrator(
        options.projectId,
        documents,
        config
      );

      // Set up progress callback if provided
      if (options.onProgress) {
        const totalPasses = mode === ExtractionMode.Standard ? 3 : 5;
        orchestrator.setProgressCallback((event) => {
          if (event.type === 'status' || event.type === 'pass_complete') {
            const data = event.data as {
              status?: string;
              progress?: number;
              currentPass?: number;
              message?: string;
              itemsFound?: number;
              observationsFound?: number;
            };
            options.onProgress!({
              status: (data.status as import('./types').ExtractionStatus) ?? 'initializing',
              progress: data.progress ?? 0,
              currentPass: data.currentPass ?? 0,
              totalPasses,
              message: data.message ?? '',
              itemsFound: data.itemsFound ?? 0,
              observationsFound: data.observationsFound ?? 0,
              timestamp: new Date(),
            });
          }
        });
      }

      // Run extraction based on mode
      let session: import('./types').ExtractionSession;
      if (mode === ExtractionMode.Standard) {
        session = await orchestrator.runStandard();
      } else {
        session = await orchestrator.run();
      }

      // Build summary
      const durationMs = Date.now() - startTime;
      const summary = ExtractionService.buildSummary(session, durationMs);

      return {
        success: true,
        session,
        workPackages: session.workPackages,
        observations: session.observations,
        summary,
      };
    } catch (error) {
      return ExtractionService.handleError(error, startTime);
    }
  }

  /**
   * Quick extraction for estimates - uses Standard mode with minimal configuration.
   * Optimized for speed over thoroughness.
   *
   * @param projectId - Project identifier
   * @param documents - Documents to extract from
   * @returns Extraction result
   */
  static async quickExtract(
    projectId: string,
    documents: ExtractionInput[]
  ): Promise<ExtractionResult | ExtractionError> {
    return ExtractionService.extract({
      projectId,
      documents,
      mode: ExtractionMode.Standard,
      minimumConfidence: 0.3, // More lenient for quick estimates
    });
  }

  /**
   * Deep extraction for bid preparation - uses Comprehensive mode.
   * Optimized for maximum coverage and accuracy.
   *
   * @param projectId - Project identifier
   * @param documents - Documents to extract from
   * @param onProgress - Optional progress callback
   * @returns Extraction result
   */
  static async deepExtract(
    projectId: string,
    documents: ExtractionInput[],
    onProgress?: (event: ExtractionProgressEvent) => void
  ): Promise<ExtractionResult | ExtractionError> {
    return ExtractionService.extract({
      projectId,
      documents,
      mode: ExtractionMode.Comprehensive,
      minimumConfidence: 0.7, // Higher threshold for bid accuracy
      onProgress,
    });
  }

  /**
   * Get the estimated cost for an extraction based on documents and mode.
   *
   * @param documents - Documents to extract from
   * @param mode - Extraction mode
   * @returns Estimated cost in USD
   */
  static estimateCost(
    documents: ExtractionInput[],
    mode: ExtractionMode = ExtractionMode.Standard
  ): { estimatedCost: number; breakdown: CostBreakdown } {
    const totalPages = documents.reduce((sum, doc) => sum + (doc.pageCount ?? 50), 0);

    // Rough token estimates based on page count
    const tokensPerPage = 2000;
    const inputTokens = totalPages * tokensPerPage;

    // Output tokens vary by mode
    const outputMultiplier = mode === ExtractionMode.Standard ? 0.3 : 0.5;
    const outputTokens = inputTokens * outputMultiplier;

    // Calculate costs per model
    const geminiCost =
      (inputTokens * 1.25 + outputTokens * 10.0) / 1_000_000;
    const claudeCost =
      (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;

    // Total based on mode
    let estimatedCost: number;
    if (mode === ExtractionMode.Standard) {
      // 2 Gemini passes + 1 Claude pass
      estimatedCost = geminiCost * 2 + claudeCost * 0.5; // Claude only gets filtered docs
    } else {
      // 4 Gemini passes + 1 Claude pass
      estimatedCost = geminiCost * 4 + claudeCost * 0.5;
    }

    return {
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      breakdown: {
        totalPages,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        geminiPasses: mode === ExtractionMode.Standard ? 2 : 4,
        claudePasses: 1,
        geminiCost: Math.round(geminiCost * 100) / 100,
        claudeCost: Math.round(claudeCost * 100) / 100,
      },
    };
  }

  /**
   * Build extraction config from options
   */
  private static buildConfig(
    options: ExtractionOptions,
    mode: ExtractionMode
  ): ExtractionConfig {
    return {
      ...DEFAULT_EXTRACTION_CONFIG,
      primaryModel: options.primaryModel ?? DEFAULT_EXTRACTION_CONFIG.primaryModel,
      validationModel: options.validationModel ?? DEFAULT_EXTRACTION_CONFIG.validationModel,
      maxPasses: mode === ExtractionMode.Standard ? 3 : 5,
      enableIterativeRefinement: mode === ExtractionMode.Comprehensive,
      enableCrossModelValidation: true,
      focusTrades: options.focusTrades,
      skipTrades: options.skipTrades,
      minimumConfidence: options.minimumConfidence ?? DEFAULT_EXTRACTION_CONFIG.minimumConfidence,
      flagThreshold: DEFAULT_EXTRACTION_CONFIG.flagThreshold,
    };
  }

  /**
   * Build summary from completed session
   */
  private static buildSummary(
    session: import('./types').ExtractionSession,
    durationMs: number
  ): ExtractionSummary {
    // Calculate average confidence
    const allItems = session.workPackages.flatMap((pkg) => pkg.lineItems);
    const avgConfidence =
      allItems.length > 0
        ? allItems.reduce((sum, item) => sum + item.extraction.confidence.overall, 0) /
          allItems.length
        : 0;

    // Estimate cost from passes
    let estimatedCost = 0;
    for (const pass of session.passes) {
      if (pass.tokensUsed) {
        const isGemini = pass.model.includes('gemini');
        const inputRate = isGemini ? 1.25 : 3.0;
        const outputRate = isGemini ? 10.0 : 15.0;
        estimatedCost +=
          (pass.tokensUsed.input * inputRate + pass.tokensUsed.output * outputRate) /
          1_000_000;
      }
    }

    return {
      totalWorkPackages: session.metrics.totalWorkPackages,
      totalLineItems: session.metrics.totalLineItems,
      totalObservations: session.metrics.totalObservations,
      criticalObservations: session.metrics.criticalObservations,
      itemsNeedingReview: session.metrics.itemsNeedingReview,
      csiDivisionsCovered: session.metrics.csiDivisionsCovered,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      durationMs,
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      passesCompleted: session.passes.length,
      cacheHits: 0, // Would need to track in orchestrator
    };
  }

  /**
   * Convert errors to ExtractionError responses
   */
  private static handleError(error: unknown, _startTime: number): ExtractionError {
    const message = error instanceof Error ? error.message : String(error);

    // Categorize error
    let code = ExtractionErrorCode.UNKNOWN_ERROR;
    if (message.includes('API key') || message.includes('authentication')) {
      code = ExtractionErrorCode.AUTHENTICATION_ERROR;
    } else if (message.includes('rate limit') || message.includes('429')) {
      code = ExtractionErrorCode.RATE_LIMIT_ERROR;
    } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      code = ExtractionErrorCode.TIMEOUT_ERROR;
    } else if (message.includes('parse') || message.includes('JSON')) {
      code = ExtractionErrorCode.MODEL_RESPONSE_ERROR;
    } else if (message.includes('read') || message.includes('file')) {
      code = ExtractionErrorCode.DOCUMENT_READ_ERROR;
    }

    return {
      success: false,
      code,
      message,
    };
  }
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

// Re-export orchestrator for direct access if needed
export { ExtractionOrchestrator } from './orchestrator';

// Note: Client classes are not exported directly to avoid build-time issues
// with Node.js-specific modules. Import them directly if needed:
// import { GeminiClient } from '@/lib/extraction/clients/gemini';
// import { ClaudeClient } from '@/lib/extraction/clients/claude';
// import { OpenAIClient } from '@/lib/extraction/clients/openai';

// ============================================================================
// LARGE DOCUMENT SUPPORT
// ============================================================================

// Re-export large document components
export {
  BatchProcessor,
  TradeContextManager,
  processDocuments,
  type ExtractionBatch,
  type BatchResults,
  type BatchProcessorOptions,
  type BatchProgressEvent,
  type DocumentProcessingResult,
  type BatchCostBreakdown,
} from './batch-processor';

export {
  LargeDocumentOrchestrator,
  extractLargeDocuments,
  type LargeDocumentExtractionOptions,
  type LargeDocumentProgressEvent,
  type LargeDocumentExtractionResult,
} from './large-document-orchestrator';

// Re-export page classifier
export {
  classifyDocument,
  classifyPage,
  classifyBySheetPrefix,
  classifyByContent,
  getPagesByTrade,
  getPagesByCSI,
  getUnclassifiedPages,
  estimateTradeTokens,
  SHEET_PREFIX_MAP,
  CSI_DIVISIONS,
  type PageClassification,
  type ClassifiedDocument,
} from './page-classifier';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ExtractionService;
