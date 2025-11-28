/**
 * Large Document Orchestrator
 *
 * Orchestrates extraction for large documents (100+ pages, 250MB+) by:
 * 1. Splitting documents into pages
 * 2. Classifying pages by trade/CSI division
 * 3. Creating batches for efficient processing
 * 4. Running extraction on each batch
 * 5. Merging results into unified work packages
 *
 * This orchestrator extends the standard extraction workflow to handle
 * documents that exceed single-context limits.
 */

import { GeminiClient } from './clients/gemini';
import { ClaudeClient } from './clients/claude';
import {
  BatchProcessor,
  ExtractionBatch,
  BatchResults,
  BatchProcessorOptions,
  BatchProgressEvent,
  TradeContextManager,
  processDocuments,
} from './batch-processor';
import {
  ExtractionSession,
  ExtractionConfig,
  ExtractionDocument,
  ExtractionStatus,
  ExtractionMetrics,
  ExtractionPass,
  ExtractedWorkPackage,
  ExtractedLineItem,
  AIObservation,
  DEFAULT_EXTRACTION_CONFIG,
  GeminiExtractionResponse,
  GeminiRawWorkPackage,
  GeminiRawLineItem,
  ConfidenceScore,
  CSIClassification,
  ExtractionMetadata,
} from './types';
import { ProcessedPage } from '@/lib/pdf-utils';
import { prisma } from '@/lib/prisma';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Options for large document extraction
 */
export interface LargeDocumentExtractionOptions {
  /** Project ID */
  projectId: string;

  /** Documents with their PDF buffers */
  documents: Array<{
    document: ExtractionDocument;
    buffer: Buffer;
  }>;

  /** Extraction config */
  config?: ExtractionConfig;

  /** Batch processor options */
  batchOptions?: BatchProcessorOptions;

  /** Progress callback */
  onProgress?: (event: LargeDocumentProgressEvent) => void;
}

/**
 * Progress event for large document extraction
 */
export interface LargeDocumentProgressEvent {
  /** Overall status */
  status: string;

  /** Phase of extraction */
  phase: 'preprocessing' | 'classification' | 'extraction' | 'merging' | 'validation';

  /** Overall progress (0-100) */
  progress: number;

  /** Current message */
  message: string;

  /** Documents processed */
  documentsProcessed: number;

  /** Total documents */
  totalDocuments: number;

  /** Batches processed */
  batchesProcessed: number;

  /** Total batches */
  totalBatches: number;

  /** Items found so far */
  itemsFound: number;

  /** Observations so far */
  observationsFound: number;

  /** Current batch info */
  currentBatch?: {
    trade: string;
    pageCount: number;
  };
}

/**
 * Result of large document extraction
 */
export interface LargeDocumentExtractionResult {
  /** Whether extraction succeeded */
  success: boolean;

  /** Complete session */
  session: ExtractionSession;

  /** Work packages (merged from all batches) */
  workPackages: ExtractedWorkPackage[];

  /** Observations */
  observations: AIObservation[];

  /** Statistics */
  stats: {
    totalDocuments: number;
    totalPages: number;
    totalBatches: number;
    tradesProcessed: string[];
    processingTimeMs: number;
    estimatedCost: number;
  };

  /** Errors encountered */
  errors: string[];
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Orchestrates extraction for large documents
 */
export class LargeDocumentOrchestrator {
  private gemini: GeminiClient;
  private claude: ClaudeClient | null = null;
  private session: ExtractionSession;
  private batchProcessor: BatchProcessor | null = null;
  private progressCallback?: (event: LargeDocumentProgressEvent) => void;
  private startTime: number = 0;

  constructor(
    private projectId: string,
    private config: ExtractionConfig = DEFAULT_EXTRACTION_CONFIG
  ) {
    this.gemini = new GeminiClient();
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.claude = new ClaudeClient();
      } catch {
        console.warn('Claude client not available');
      }
    }
    this.session = this.initializeSession();
  }

  /**
   * Run extraction on large documents
   */
  async extract(options: LargeDocumentExtractionOptions): Promise<LargeDocumentExtractionResult> {
    this.startTime = Date.now();
    this.progressCallback = options.onProgress;
    const errors: string[] = [];

    try {
      // Phase 1: Preprocess documents
      this.emitProgress({
        status: 'preprocessing',
        phase: 'preprocessing',
        progress: 5,
        message: 'Preprocessing documents...',
        documentsProcessed: 0,
        totalDocuments: options.documents.length,
        batchesProcessed: 0,
        totalBatches: 0,
        itemsFound: 0,
        observationsFound: 0,
      });

      const sessionId = this.session.id;
      const { processor, results, totalBatches, estimatedCost } = await processDocuments(
        sessionId,
        options.documents,
        {
          ...options.batchOptions,
          focusTrades: this.config.focusTrades,
          skipTrades: this.config.skipTrades,
          onProgress: (event) => this.handleBatchProgress(event, options.documents.length),
        }
      );

      this.batchProcessor = processor;

      // Collect any preprocessing errors
      for (const result of results) {
        errors.push(...result.errors);
      }

      // Calculate totals
      const totalPages = results.reduce((sum, r) => sum + r.totalPages, 0);
      const tradesProcessed = new Set<string>();
      for (const batch of processor.getBatches()) {
        tradesProcessed.add(batch.trade);
      }

      console.log(`Created ${totalBatches} batches, estimated cost: $${estimatedCost}`);

      // Phase 2: Run extraction on each batch
      this.emitProgress({
        status: 'extracting',
        phase: 'extraction',
        progress: 20,
        message: `Starting extraction of ${totalBatches} batches...`,
        documentsProcessed: options.documents.length,
        totalDocuments: options.documents.length,
        batchesProcessed: 0,
        totalBatches,
        itemsFound: 0,
        observationsFound: 0,
      });

      const batches = processor.getBatches();
      let batchesProcessed = 0;
      let totalItemsFound = 0;
      let totalObservationsFound = 0;

      for (const batch of batches) {
        try {
          // Update batch status
          processor.updateBatchStatus(batch.id, 'processing');

          this.emitProgress({
            status: 'extracting',
            phase: 'extraction',
            progress: 20 + Math.round((batchesProcessed / totalBatches) * 60),
            message: `Extracting ${batch.trade} (${batch.pages.length} pages)...`,
            documentsProcessed: options.documents.length,
            totalDocuments: options.documents.length,
            batchesProcessed,
            totalBatches,
            itemsFound: totalItemsFound,
            observationsFound: totalObservationsFound,
            currentBatch: {
              trade: batch.trade,
              pageCount: batch.pages.length,
            },
          });

          // Run extraction on this batch
          const batchResults = await this.extractBatch(batch);

          // Update totals
          totalItemsFound += batchResults.lineItems.length;
          totalObservationsFound += batchResults.observations.length;

          // Store results
          processor.updateBatchStatus(batch.id, 'completed', batchResults);

          batchesProcessed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Batch ${batch.trade}: ${errorMsg}`);
          processor.updateBatchStatus(batch.id, 'failed', undefined, errorMsg);
          batchesProcessed++;
        }
      }

      // Phase 3: Merge results from all batches
      this.emitProgress({
        status: 'merging',
        phase: 'merging',
        progress: 85,
        message: 'Merging results from all batches...',
        documentsProcessed: options.documents.length,
        totalDocuments: options.documents.length,
        batchesProcessed: totalBatches,
        totalBatches,
        itemsFound: totalItemsFound,
        observationsFound: totalObservationsFound,
      });

      const mergedResults = this.mergeResults(batches);
      this.session.workPackages = mergedResults.workPackages;
      this.session.observations = mergedResults.observations;

      // Phase 4: Cross-validation (if enabled and Claude available)
      if (this.config.enableCrossModelValidation && this.claude) {
        this.emitProgress({
          status: 'validating',
          phase: 'validation',
          progress: 90,
          message: 'Running cross-model validation...',
          documentsProcessed: options.documents.length,
          totalDocuments: options.documents.length,
          batchesProcessed: totalBatches,
          totalBatches,
          itemsFound: totalItemsFound,
          observationsFound: totalObservationsFound,
        });

        await this.runValidation();
      }

      // Finalize session
      this.session.status = 'completed';
      this.session.completedAt = new Date();
      this.updateMetrics();
      await this.persistSession();

      // Calculate actual cost from batches
      const actualCost = batches.reduce(
        (sum, b) => sum + (b.results?.cost ?? 0),
        0
      );

      this.emitProgress({
        status: 'completed',
        phase: 'validation',
        progress: 100,
        message: 'Extraction completed successfully',
        documentsProcessed: options.documents.length,
        totalDocuments: options.documents.length,
        batchesProcessed: totalBatches,
        totalBatches,
        itemsFound: totalItemsFound,
        observationsFound: totalObservationsFound,
      });

      return {
        success: true,
        session: this.session,
        workPackages: this.session.workPackages,
        observations: this.session.observations,
        stats: {
          totalDocuments: options.documents.length,
          totalPages,
          totalBatches,
          tradesProcessed: Array.from(tradesProcessed),
          processingTimeMs: Date.now() - this.startTime,
          estimatedCost: actualCost || estimatedCost,
        },
        errors,
      };
    } catch (error) {
      this.session.status = 'failed';
      this.session.error = error instanceof Error ? error.message : 'Unknown error';
      await this.persistSession();

      return {
        success: false,
        session: this.session,
        workPackages: this.session.workPackages,
        observations: this.session.observations,
        stats: {
          totalDocuments: options.documents.length,
          totalPages: 0,
          totalBatches: 0,
          tradesProcessed: [],
          processingTimeMs: Date.now() - this.startTime,
          estimatedCost: 0,
        },
        errors: [...errors, this.session.error],
      };
    }
  }

  /**
   * Extract from a single batch
   */
  private async extractBatch(batch: ExtractionBatch): Promise<BatchResults> {
    const startTime = Date.now();
    const workPackages: ExtractedWorkPackage[] = [];
    const lineItems: ExtractedLineItem[] = [];
    const observations: AIObservation[] = [];
    let tokensUsed = { input: 0, output: 0 };

    try {
      // Convert pages to document format for Gemini
      const imageBuffers = batch.pages.map((p) => ({
        buffer: p.imageBuffer,
        mimeType: p.contentType,
        pageNumber: p.pageNumber,
      }));

      // Run extraction with page images
      const result = await this.gemini.extractFromPages(imageBuffers, {
        trade: batch.trade,
        csiDivisions: batch.csiDivisions,
        pageContext: batch.pages.map((p) => ({
          pageNumber: p.pageNumber,
          sheetNumber: p.sheetNumber,
          textPreview: p.textPreview,
        })),
      });

      tokensUsed = result.tokensUsed;

      // Convert raw packages to typed
      if (result.response.work_packages) {
        for (const rawPkg of result.response.work_packages) {
          const pkg = this.convertRawPackage(rawPkg, 1, batch.trade);
          workPackages.push(pkg);
          lineItems.push(...pkg.lineItems);
        }
      }

      // Handle observations
      if (result.response.ai_observations) {
        for (const rawObs of result.response.ai_observations) {
          const obs = this.convertObservation(rawObs, 1);
          observations.push(obs);
        }
      }

      // Calculate cost (Gemini pricing)
      const cost =
        (tokensUsed.input * 1.25 + tokensUsed.output * 10.0) / 1_000_000;

      return {
        workPackages,
        lineItems,
        observations,
        tokensUsed,
        cost: Math.round(cost * 100) / 100,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`Batch extraction error for ${batch.trade}:`, error);
      throw error;
    }
  }

  /**
   * Merge results from all batches
   */
  private mergeResults(batches: ExtractionBatch[]): {
    workPackages: ExtractedWorkPackage[];
    observations: AIObservation[];
  } {
    const workPackageMap = new Map<string, ExtractedWorkPackage>();
    const observations: AIObservation[] = [];

    for (const batch of batches) {
      if (!batch.results) continue;

      // Merge work packages by trade
      for (const pkg of batch.results.workPackages) {
        const key = `${pkg.trade}-${pkg.csiClassification.divisionCode}`;
        const existing = workPackageMap.get(key);

        if (existing) {
          // Merge line items into existing package
          for (const item of pkg.lineItems) {
            // Check for duplicates by description similarity
            const isDuplicate = existing.lineItems.some(
              (existingItem) =>
                this.isSimilar(existingItem.description, item.description)
            );

            if (!isDuplicate) {
              item.order = existing.lineItems.length;
              existing.lineItems.push(item);
            }
          }
          existing.itemCount = existing.lineItems.length;
        } else {
          workPackageMap.set(key, pkg);
        }
      }

      // Collect observations
      observations.push(...batch.results.observations);
    }

    return {
      workPackages: Array.from(workPackageMap.values()),
      observations,
    };
  }

  /**
   * Check if two descriptions are similar (simple fuzzy match)
   */
  private isSimilar(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const na = normalize(a);
    const nb = normalize(b);

    // Exact match after normalization
    if (na === nb) return true;

    // One contains the other
    if (na.includes(nb) || nb.includes(na)) return true;

    // Simple character overlap ratio
    const shorter = na.length < nb.length ? na : nb;
    const longer = na.length < nb.length ? nb : na;
    let matches = 0;
    for (const char of shorter) {
      if (longer.includes(char)) matches++;
    }
    const ratio = matches / shorter.length;
    return ratio > 0.8;
  }

  /**
   * Run cross-model validation
   */
  private async runValidation(): Promise<void> {
    if (!this.claude) return;

    try {
      const currentExtraction = this.buildExtractionResponse();

      // Use a sample of documents for validation
      const sampleDocs = this.session.documents.slice(0, 3);

      const result = await this.claude.crossValidation(
        sampleDocs,
        currentExtraction
      );

      // Process validation observations
      if (result.response.observations) {
        for (const obs of result.response.observations) {
          const aiObs = this.convertObservation(obs, 4);
          this.session.observations.push(aiObs);
        }
      }

      // Apply confidence adjustments
      if (result.response.validated_packages) {
        for (const validatedPkg of result.response.validated_packages) {
          const pkg = this.session.workPackages.find(
            (p) => p.packageId === validatedPkg.packageId
          );
          if (pkg && validatedPkg.confidence) {
            pkg.extraction.confidence.overall = validatedPkg.confidence;
          }
        }
      }

      // Record validation pass
      const pass: ExtractionPass = {
        passNumber: 4,
        model: 'claude-sonnet-4.5',
        purpose: 'Cross-model validation',
        startedAt: new Date(),
        completedAt: new Date(),
        newItemsFound: 0,
        itemsModified: 0,
        observationsAdded: result.response.observations?.length ?? 0,
        tokensUsed: result.tokensUsed,
      };
      this.session.passes.push(pass);
    } catch (error) {
      console.error('Validation error:', error);
      // Non-fatal - continue without validation
    }
  }

  /**
   * Handle batch progress events
   */
  private handleBatchProgress(
    event: BatchProgressEvent,
    totalDocuments: number
  ): void {
    // Convert batch progress to overall progress
    // Preprocessing is 0-20%, extraction is 20-80%
    const extractionProgress = event.totalBatches > 0
      ? (event.completedBatches / event.totalBatches) * 60
      : 0;

    this.emitProgress({
      status: event.message,
      phase: 'extraction',
      progress: Math.round(20 + extractionProgress),
      message: event.message,
      documentsProcessed: totalDocuments,
      totalDocuments,
      batchesProcessed: event.completedBatches,
      totalBatches: event.totalBatches,
      itemsFound: event.itemsFound,
      observationsFound: event.observationsFound,
      currentBatch: event.currentBatch !== undefined
        ? {
            trade: this.batchProcessor?.getBatches()[event.currentBatch]?.trade ?? '',
            pageCount: this.batchProcessor?.getBatches()[event.currentBatch]?.pages.length ?? 0,
          }
        : undefined,
    });
  }

  /**
   * Emit progress event
   */
  private emitProgress(event: LargeDocumentProgressEvent): void {
    if (this.progressCallback) {
      this.progressCallback(event);
    }
  }

  // ============================================================================
  // HELPER METHODS (similar to ExtractionOrchestrator)
  // ============================================================================

  private initializeSession(): ExtractionSession {
    return {
      id: this.generateId(),
      projectId: this.projectId,
      config: this.config,
      documents: [],
      workPackages: [],
      observations: [],
      metrics: this.createEmptyMetrics(),
      passes: [],
      status: 'initializing',
      currentPass: 0,
      progress: 0,
      startedAt: new Date(),
    };
  }

  private buildExtractionResponse(): GeminiExtractionResponse {
    return {
      project_name: undefined,
      work_packages: this.session.workPackages.map((pkg) => ({
        packageId: pkg.packageId,
        name: pkg.name,
        csi_division: pkg.csiClassification.divisionCode,
        trade: pkg.trade,
        description: pkg.description,
        line_items: pkg.lineItems.map((item) => ({
          item_number: item.itemNumber,
          description: item.description,
          action: item.action,
          quantity: item.quantity,
          unit: item.unit,
          specifications: item.specifications,
          notes: item.notes,
        })),
      })),
    };
  }

  private convertRawPackage(
    rawPkg: GeminiRawWorkPackage,
    pass: number,
    batchTrade: string
  ): ExtractedWorkPackage {
    const id = this.generateId();
    const lineItems = rawPkg.line_items.map((item, idx) =>
      this.convertRawLineItem(item, idx, pass)
    );

    return {
      id,
      packageId: rawPkg.packageId || id,
      name: rawPkg.name,
      description: rawPkg.description,
      csiClassification: this.createCSIClassification(
        rawPkg.csi_division || '00',
        rawPkg.trade || batchTrade
      ),
      trade: rawPkg.trade || batchTrade,
      scopeResponsible: rawPkg.scope_responsible,
      lineItems,
      itemCount: lineItems.length,
      estimatedComplexity: this.estimateComplexity(lineItems.length),
      keyDocuments: [],
      extraction: this.createExtractionMetadata(pass, 0.7),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private convertRawLineItem(
    rawItem: GeminiRawLineItem,
    order: number,
    pass: number
  ): ExtractedLineItem {
    return {
      id: this.generateId(),
      itemNumber: rawItem.item_number,
      description: rawItem.description,
      action: rawItem.action,
      quantity: rawItem.quantity,
      unit: rawItem.unit,
      specifications: rawItem.specifications,
      notes: rawItem.notes,
      references: [],
      order,
      extraction: this.createExtractionMetadata(
        pass,
        rawItem.flags?.includes('NEEDS_REVIEW') ? 0.5 : 0.7
      ),
    };
  }

  private convertObservation(obs: any, pass: number): AIObservation {
    const validCategories = [
      'scope_conflict', 'specification_mismatch', 'quantity_concern',
      'coordination_required', 'addendum_impact', 'warranty_requirement',
      'code_compliance', 'risk_flag', 'cost_impact', 'schedule_impact',
      'missing_information', 'substitution_available',
    ];
    const category = validCategories.includes(obs.category)
      ? (obs.category as AIObservation['category'])
      : 'missing_information';

    return {
      id: this.generateId(),
      severity: obs.severity || 'info',
      category,
      title: obs.title || 'Observation',
      insight: obs.insight || '',
      affectedWorkPackages: obs.affected_packages || [],
      affectedLineItems: obs.affected_line_items,
      references: [],
      suggestedActions: obs.suggested_actions,
      extraction: this.createExtractionMetadata(pass, 0.8),
    };
  }

  private createCSIClassification(
    divisionCode: string,
    trade: string
  ): CSIClassification {
    const divisionNames: Record<string, string> = {
      '00': 'Unclassified',
      '01': 'General Requirements',
      '03': 'Concrete',
      '06': 'Wood, Plastics, Composites',
      '21': 'Fire Suppression',
      '22': 'Plumbing',
      '23': 'HVAC',
      '26': 'Electrical',
      '27': 'Communications',
      '28': 'Electronic Safety & Security',
      '31': 'Earthwork',
      '32': 'Exterior Improvements',
    };

    return {
      divisionCode,
      divisionName: divisionNames[divisionCode] || trade,
      level: 1,
      confidence: 0.8,
      reasoning: `Classified as Division ${divisionCode} based on trade: ${trade}`,
    };
  }

  private createExtractionMetadata(
    pass: number,
    confidence: number
  ): ExtractionMetadata {
    return {
      extractedBy: 'gemini-2.5-pro',
      extractedAt: new Date(),
      confidence: this.createConfidenceScore(confidence),
      humanReviewed: false,
      extractionPass: pass,
    };
  }

  private createConfidenceScore(overall: number): ConfidenceScore {
    return {
      overall,
      components: {
        dataCompleteness: overall,
        sourceClarity: overall,
        crossReferenceMatch: 0.5,
        specificationMatch: 0.5,
        quantityReasonableness: overall,
      },
      reasoning: 'Batch extraction confidence',
      flags: [],
    };
  }

  private estimateComplexity(itemCount: number): 'low' | 'medium' | 'high' {
    if (itemCount < 5) return 'low';
    if (itemCount < 15) return 'medium';
    return 'high';
  }

  private createEmptyMetrics(): ExtractionMetrics {
    return {
      totalWorkPackages: 0,
      totalLineItems: 0,
      totalObservations: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      csiDivisionsCovered: [],
      documentsProcessed: 0,
      pagesProcessed: 0,
      itemsNeedingReview: 0,
      criticalObservations: 0,
      warningObservations: 0,
    };
  }

  private updateMetrics(): void {
    const metrics = this.session.metrics;
    metrics.totalWorkPackages = this.session.workPackages.length;
    metrics.totalLineItems = this.session.workPackages.reduce(
      (sum, pkg) => sum + pkg.lineItems.length,
      0
    );
    metrics.totalObservations = this.session.observations.length;

    // CSI divisions
    metrics.csiDivisionsCovered = [
      ...new Set(
        this.session.workPackages.map((p) => p.csiClassification.divisionCode)
      ),
    ];

    // Items needing review
    metrics.itemsNeedingReview = this.session.workPackages.reduce(
      (sum, pkg) =>
        sum +
        pkg.lineItems.filter((i) => i.extraction.confidence.overall < 0.6).length,
      0
    );

    // Observations
    metrics.criticalObservations = this.session.observations.filter(
      (o) => o.severity === 'critical'
    ).length;
    metrics.warningObservations = this.session.observations.filter(
      (o) => o.severity === 'warning'
    ).length;
  }

  private async persistSession(): Promise<void> {
    try {
      await prisma.extractionSession.upsert({
        where: { id: this.session.id },
        create: {
          id: this.session.id,
          projectId: this.projectId,
          config: JSON.stringify(this.session.config),
          status: this.session.status,
          currentPass: this.session.currentPass,
          progress: this.session.progress,
          statusMessage: this.session.statusMessage,
          metrics: JSON.stringify(this.session.metrics),
          passes: JSON.stringify(this.session.passes),
          error: this.session.error,
          startedAt: this.session.startedAt,
          completedAt: this.session.completedAt,
        },
        update: {
          status: this.session.status,
          currentPass: this.session.currentPass,
          progress: this.session.progress,
          metrics: JSON.stringify(this.session.metrics),
          passes: JSON.stringify(this.session.passes),
          error: this.session.error,
          completedAt: this.session.completedAt,
        },
      });
    } catch (error) {
      console.error('Failed to persist session:', error);
    }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get current session
   */
  getSession(): ExtractionSession {
    return this.session;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Extract from large documents
 */
export async function extractLargeDocuments(
  options: LargeDocumentExtractionOptions
): Promise<LargeDocumentExtractionResult> {
  const orchestrator = new LargeDocumentOrchestrator(
    options.projectId,
    options.config
  );
  return orchestrator.extract(options);
}
