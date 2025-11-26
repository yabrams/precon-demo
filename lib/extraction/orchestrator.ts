/**
 * Extraction Orchestrator
 *
 * Coordinates the multi-pass extraction workflow:
 * - Pass 1: Initial extraction with Gemini
 * - Pass 2: Self-review to find missed items
 * - Pass 3: Validation with Claude (optional, based on config)
 *
 * Manages session state, progress updates, and database persistence.
 */

import { prisma } from '@/lib/prisma';
import { GeminiClient } from './clients/gemini';
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
  GeminiExtractionResponse,
  GeminiRawWorkPackage,
  GeminiRawLineItem,
  DEFAULT_EXTRACTION_CONFIG,
  ConfidenceScore,
  CSIClassification,
  ExtractionMetadata,
} from './types';

// Event emitter for real-time updates
type ProgressCallback = (event: ProgressEvent) => void;

interface ProgressEvent {
  type: 'status' | 'item_found' | 'observation' | 'pass_complete' | 'error';
  sessionId: string;
  data: unknown;
}

export class ExtractionOrchestrator {
  private gemini: GeminiClient;
  private session: ExtractionSession;
  private progressCallback?: ProgressCallback;

  constructor(
    private projectId: string,
    private documents: ExtractionDocument[],
    private config: ExtractionConfig = DEFAULT_EXTRACTION_CONFIG
  ) {
    this.gemini = new GeminiClient();
    this.session = this.initializeSession();
  }

  /**
   * Set callback for progress updates (for WebSocket broadcasting)
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Initialize a new extraction session
   */
  private initializeSession(): ExtractionSession {
    return {
      id: this.generateId(),
      projectId: this.projectId,
      config: this.config,
      documents: this.documents,
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

  /**
   * Run the full extraction workflow
   */
  async run(): Promise<ExtractionSession> {
    try {
      // Create session in database
      await this.persistSession();

      // Pass 1: Initial extraction
      await this.runPass1();

      // Pass 2: Self-review
      await this.runPass2();

      // Pass 3: Validation (if enabled and Claude available)
      if (this.config.enableCrossModelValidation) {
        await this.runPass3();
      }

      // Finalize
      this.session.status = 'completed';
      this.session.completedAt = new Date();
      this.updateMetrics();
      await this.persistSession();

      this.emitProgress('status', {
        status: 'completed',
        message: 'Extraction completed successfully',
      });

      return this.session;
    } catch (error) {
      this.session.status = 'failed';
      this.session.error = error instanceof Error ? error.message : 'Unknown error';
      await this.persistSession();

      this.emitProgress('error', {
        message: this.session.error,
      });

      throw error;
    }
  }

  /**
   * Pass 1: Initial extraction with Gemini
   */
  private async runPass1(): Promise<void> {
    this.session.status = 'pass_1_extracting';
    this.session.currentPass = 1;
    this.session.statusMessage = 'Extracting work packages from documents...';
    this.session.progress = 10;

    this.emitProgress('status', {
      status: this.session.status,
      currentPass: 1,
      progress: 10,
      message: 'Starting initial extraction...',
    });

    const passStart = new Date();
    let tokensUsed = { input: 0, output: 0 };

    try {
      // Run Gemini extraction
      const result = await this.gemini.extractWorkPackages(
        this.documents.filter(d => d.type === 'design_drawings')
      );

      tokensUsed = result.tokensUsed;

      // Convert raw response to typed work packages
      const workPackages = this.convertRawPackages(result.response, 1);
      this.session.workPackages = workPackages;

      // Emit found items
      for (const pkg of workPackages) {
        for (const item of pkg.lineItems) {
          this.emitProgress('item_found', {
            workPackageId: pkg.id,
            workPackageName: pkg.name,
            item: {
              id: item.id,
              description: item.description,
              action: item.action,
            },
            isNew: true,
          });
        }
      }

      this.session.progress = 35;

      // Record pass
      const pass: ExtractionPass = {
        passNumber: 1,
        model: 'gemini-2.5-pro',
        purpose: 'Initial extraction from design drawings',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: workPackages.reduce((sum, p) => sum + p.lineItems.length, 0),
        itemsModified: 0,
        observationsAdded: 0,
        tokensUsed,
      };
      this.session.passes.push(pass);

      this.emitProgress('pass_complete', {
        passNumber: 1,
        newItems: pass.newItemsFound,
        modifiedItems: 0,
        observations: 0,
        duration: (pass.completedAt!.getTime() - pass.startedAt.getTime()) / 1000,
      });

      await this.persistSession();
    } catch (error) {
      const pass: ExtractionPass = {
        passNumber: 1,
        model: 'gemini-2.5-pro',
        purpose: 'Initial extraction from design drawings',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: 0,
        itemsModified: 0,
        observationsAdded: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.session.passes.push(pass);
      throw error;
    }
  }

  /**
   * Pass 2: Self-review to find missed items
   */
  private async runPass2(): Promise<void> {
    this.session.status = 'pass_2_reviewing';
    this.session.currentPass = 2;
    this.session.statusMessage = 'Reviewing extraction for missed items...';
    this.session.progress = 40;

    this.emitProgress('status', {
      status: this.session.status,
      currentPass: 2,
      progress: 40,
      message: 'Self-reviewing extraction...',
    });

    const passStart = new Date();
    let tokensUsed = { input: 0, output: 0 };

    try {
      // Prepare current extraction for review
      const currentExtraction: GeminiExtractionResponse = {
        project_name: undefined,
        work_packages: this.session.workPackages.map(pkg => ({
          packageId: pkg.packageId,
          name: pkg.name,
          csi_division: pkg.csiClassification.divisionCode,
          trade: pkg.trade,
          description: pkg.description,
          line_items: pkg.lineItems.map(item => ({
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

      // Run self-review
      const result = await this.gemini.reviewExtraction(
        this.documents.filter(d => d.type === 'design_drawings'),
        currentExtraction
      );

      tokensUsed = result.tokensUsed;

      // Apply additions
      let newItemsCount = 0;
      let modifiedItemsCount = 0;

      if (result.response.additions && result.response.additions.length > 0) {
        for (const addition of result.response.additions) {
          const targetPackage = this.session.workPackages.find(
            p => p.packageId === (addition as any).work_package
          );
          if (targetPackage) {
            const newItem = this.convertRawLineItem(
              addition as GeminiRawLineItem,
              targetPackage.lineItems.length,
              2
            );
            targetPackage.lineItems.push(newItem);
            targetPackage.itemCount = targetPackage.lineItems.length;
            newItemsCount++;

            this.emitProgress('item_found', {
              workPackageId: targetPackage.id,
              workPackageName: targetPackage.name,
              item: {
                id: newItem.id,
                description: newItem.description,
                action: newItem.action,
              },
              isNew: true,
            });
          }
        }
      }

      // Apply modifications
      if (result.response.modifications && result.response.modifications.length > 0) {
        for (const mod of result.response.modifications) {
          // Find and update the item
          for (const pkg of this.session.workPackages) {
            const item = pkg.lineItems.find(
              i =>
                i.itemNumber === mod.original_item_ref ||
                i.description.includes(mod.original_item_ref)
            );
            if (item && mod.changes) {
              Object.assign(item, mod.changes);
              item.extraction.refinedInPass = [
                ...(item.extraction.refinedInPass || []),
                2,
              ];
              modifiedItemsCount++;
            }
          }
        }
      }

      // Handle new packages
      if ((result.response as any).new_packages) {
        for (const rawPkg of (result.response as any).new_packages) {
          const newPkg = this.convertRawPackage(rawPkg, 2);
          this.session.workPackages.push(newPkg);
          newItemsCount += newPkg.lineItems.length;
        }
      }

      this.session.progress = 70;

      // Record pass
      const pass: ExtractionPass = {
        passNumber: 2,
        model: 'gemini-2.5-pro',
        purpose: 'Self-review for missed items',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: newItemsCount,
        itemsModified: modifiedItemsCount,
        observationsAdded: 0,
        tokensUsed,
      };
      this.session.passes.push(pass);

      this.emitProgress('pass_complete', {
        passNumber: 2,
        newItems: newItemsCount,
        modifiedItems: modifiedItemsCount,
        observations: 0,
        duration: (pass.completedAt!.getTime() - pass.startedAt.getTime()) / 1000,
      });

      await this.persistSession();
    } catch (error) {
      // Non-fatal: log and continue
      console.error('Pass 2 error:', error);
      const pass: ExtractionPass = {
        passNumber: 2,
        model: 'gemini-2.5-pro',
        purpose: 'Self-review for missed items',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: 0,
        itemsModified: 0,
        observationsAdded: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.session.passes.push(pass);
    }
  }

  /**
   * Pass 3: Validation (simplified for Phase 1)
   */
  private async runPass3(): Promise<void> {
    this.session.status = 'pass_3_validating';
    this.session.currentPass = 3;
    this.session.statusMessage = 'Validating extraction results...';
    this.session.progress = 75;

    this.emitProgress('status', {
      status: this.session.status,
      currentPass: 3,
      progress: 75,
      message: 'Running validation...',
    });

    const passStart = new Date();

    try {
      // For Phase 1, we'll do basic validation without Claude
      // This can be enhanced in Phase 2 to use Claude for cross-validation

      // Generate basic observations based on extraction data
      const observations = this.generateBasicObservations();
      this.session.observations = observations;

      for (const obs of observations) {
        this.emitProgress('observation', { observation: obs });
      }

      this.session.progress = 95;

      const pass: ExtractionPass = {
        passNumber: 3,
        model: 'gemini-2.5-pro', // Will be claude in Phase 2
        purpose: 'Validation and observation generation',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: 0,
        itemsModified: 0,
        observationsAdded: observations.length,
      };
      this.session.passes.push(pass);

      this.emitProgress('pass_complete', {
        passNumber: 3,
        newItems: 0,
        modifiedItems: 0,
        observations: observations.length,
        duration: (pass.completedAt!.getTime() - pass.startedAt.getTime()) / 1000,
      });

      await this.persistSession();
    } catch (error) {
      console.error('Pass 3 error:', error);
      const pass: ExtractionPass = {
        passNumber: 3,
        model: 'gemini-2.5-pro',
        purpose: 'Validation and observation generation',
        startedAt: passStart,
        completedAt: new Date(),
        newItemsFound: 0,
        itemsModified: 0,
        observationsAdded: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.session.passes.push(pass);
    }
  }

  /**
   * Generate basic observations from extraction data
   */
  private generateBasicObservations(): AIObservation[] {
    const observations: AIObservation[] = [];

    // Check for items without quantities
    const itemsWithoutQty = this.session.workPackages.flatMap(pkg =>
      pkg.lineItems.filter(item => !item.quantity).map(item => ({
        pkgId: pkg.id,
        pkgName: pkg.name,
        itemId: item.id,
        itemDesc: item.description,
      }))
    );

    if (itemsWithoutQty.length > 5) {
      observations.push({
        id: this.generateId(),
        severity: 'warning',
        category: 'missing_information',
        title: 'Multiple items missing quantities',
        insight: `${itemsWithoutQty.length} line items are missing quantity information. These will need manual takeoff or verification.`,
        affectedWorkPackages: [
          ...new Set(itemsWithoutQty.map(i => i.pkgId)),
        ],
        affectedLineItems: itemsWithoutQty.map(i => i.itemId),
        references: [],
        suggestedActions: [
          'Review source documents for quantity callouts',
          'Perform manual takeoff for missing quantities',
        ],
        extraction: this.createExtractionMetadata(3, 0.8),
      });
    }

    // Check for low-confidence packages
    const lowConfidencePkgs = this.session.workPackages.filter(
      pkg => pkg.extraction.confidence.overall < 0.6
    );

    for (const pkg of lowConfidencePkgs) {
      observations.push({
        id: this.generateId(),
        severity: 'info',
        category: 'missing_information',
        title: `Low confidence extraction: ${pkg.name}`,
        insight: `The ${pkg.name} package has a confidence score of ${Math.round(pkg.extraction.confidence.overall * 100)}%. Review recommended.`,
        affectedWorkPackages: [pkg.id],
        references: [],
        suggestedActions: ['Manual review recommended'],
        extraction: this.createExtractionMetadata(3, 0.9),
      });
    }

    // Check for potential coordination items
    const hasMechanical = this.session.workPackages.some(p =>
      p.trade.toLowerCase().includes('mechanical')
    );
    const hasElectrical = this.session.workPackages.some(p =>
      p.trade.toLowerCase().includes('electrical')
    );

    if (hasMechanical && hasElectrical) {
      observations.push({
        id: this.generateId(),
        severity: 'info',
        category: 'coordination_required',
        title: 'MEP Coordination Required',
        insight:
          'Both Mechanical and Electrical scopes identified. Ensure power connections for mechanical equipment are coordinated between packages.',
        affectedWorkPackages: this.session.workPackages
          .filter(
            p =>
              p.trade.toLowerCase().includes('mechanical') ||
              p.trade.toLowerCase().includes('electrical')
          )
          .map(p => p.id),
        references: [],
        suggestedActions: [
          'Verify electrical connections for all RTUs and equipment',
          'Check disconnect switch requirements',
        ],
        extraction: this.createExtractionMetadata(3, 0.7),
      });
    }

    return observations;
  }

  /**
   * Convert raw Gemini response to typed work packages
   */
  private convertRawPackages(
    response: GeminiExtractionResponse,
    pass: number
  ): ExtractedWorkPackage[] {
    return response.work_packages.map(rawPkg =>
      this.convertRawPackage(rawPkg, pass)
    );
  }

  private convertRawPackage(
    rawPkg: GeminiRawWorkPackage,
    pass: number
  ): ExtractedWorkPackage {
    const id = this.generateId();
    const lineItems = rawPkg.line_items.map((item, idx) =>
      this.convertRawLineItem(item, idx, pass)
    );

    return {
      id,
      packageId: rawPkg.packageId,
      name: rawPkg.name,
      description: rawPkg.description,
      csiClassification: this.createCSIClassification(rawPkg.csi_division, rawPkg.trade),
      trade: rawPkg.trade,
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

  private createCSIClassification(
    divisionCode: string,
    trade: string
  ): CSIClassification {
    const divisionNames: Record<string, string> = {
      '01': 'General Requirements',
      '02': 'Existing Conditions',
      '03': 'Concrete',
      '04': 'Masonry',
      '05': 'Metals',
      '06': 'Wood, Plastics, Composites',
      '07': 'Thermal & Moisture Protection',
      '08': 'Openings',
      '09': 'Finishes',
      '10': 'Specialties',
      '11': 'Equipment',
      '12': 'Furnishings',
      '13': 'Special Construction',
      '14': 'Conveying Equipment',
      '21': 'Fire Suppression',
      '22': 'Plumbing',
      '23': 'HVAC',
      '26': 'Electrical',
      '27': 'Communications',
      '28': 'Electronic Safety & Security',
      '31': 'Earthwork',
      '32': 'Exterior Improvements',
      '33': 'Utilities',
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
      reasoning: 'Initial extraction confidence',
      flags: [],
    };
  }

  private estimateComplexity(
    itemCount: number
  ): 'low' | 'medium' | 'high' {
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

    // Confidence distribution
    let high = 0,
      medium = 0,
      low = 0;
    for (const pkg of this.session.workPackages) {
      for (const item of pkg.lineItems) {
        if (item.extraction.confidence.overall > 0.8) high++;
        else if (item.extraction.confidence.overall > 0.5) medium++;
        else low++;
      }
    }
    metrics.confidenceDistribution = { high, medium, low };

    // CSI divisions
    metrics.csiDivisionsCovered = [
      ...new Set(this.session.workPackages.map(p => p.csiClassification.divisionCode)),
    ];

    metrics.documentsProcessed = this.documents.length;

    // Items needing review
    metrics.itemsNeedingReview = this.session.workPackages.reduce(
      (sum, pkg) =>
        sum +
        pkg.lineItems.filter(i => i.extraction.confidence.overall < 0.6).length,
      0
    );

    // Observations
    metrics.criticalObservations = this.session.observations.filter(
      o => o.severity === 'critical'
    ).length;
    metrics.warningObservations = this.session.observations.filter(
      o => o.severity === 'warning'
    ).length;
  }

  /**
   * Persist session to database
   */
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
          statusMessage: this.session.statusMessage,
          metrics: JSON.stringify(this.session.metrics),
          passes: JSON.stringify(this.session.passes),
          error: this.session.error,
          completedAt: this.session.completedAt,
        },
      });

      // Persist work packages
      for (const pkg of this.session.workPackages) {
        await prisma.extractedWorkPackageRecord.upsert({
          where: { id: pkg.id },
          create: {
            id: pkg.id,
            sessionId: this.session.id,
            packageId: pkg.packageId,
            name: pkg.name,
            description: pkg.description,
            trade: pkg.trade,
            scopeResponsible: pkg.scopeResponsible,
            csiDivisionCode: pkg.csiClassification.divisionCode,
            csiDivisionName: pkg.csiClassification.divisionName,
            csiSectionCode: pkg.csiClassification.sectionCode,
            csiSectionName: pkg.csiClassification.sectionName,
            csiConfidence: pkg.csiClassification.confidence,
            csiReasoning: pkg.csiClassification.reasoning,
            itemCount: pkg.itemCount,
            complexity: pkg.estimatedComplexity,
            extractedBy: pkg.extraction.extractedBy,
            extractionPass: pkg.extraction.extractionPass,
            confidence: pkg.extraction.confidence.overall,
            confidenceDetails: JSON.stringify(pkg.extraction.confidence),
          },
          update: {
            name: pkg.name,
            description: pkg.description,
            itemCount: pkg.itemCount,
            confidence: pkg.extraction.confidence.overall,
            confidenceDetails: JSON.stringify(pkg.extraction.confidence),
          },
        });

        // Persist line items
        for (const item of pkg.lineItems) {
          await prisma.extractedLineItemRecord.upsert({
            where: { id: item.id },
            create: {
              id: item.id,
              workPackageId: pkg.id,
              itemNumber: item.itemNumber,
              description: item.description,
              action: item.action,
              quantity: item.quantity,
              unit: item.unit,
              specifications: item.specifications,
              notes: item.notes,
              orderIndex: item.order,
              extractedBy: item.extraction.extractedBy,
              extractionPass: item.extraction.extractionPass,
              confidence: item.extraction.confidence.overall,
              confidenceDetails: JSON.stringify(item.extraction.confidence),
              flags: JSON.stringify(item.extraction.confidence.flags),
            },
            update: {
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              specifications: item.specifications,
              notes: item.notes,
              confidence: item.extraction.confidence.overall,
            },
          });
        }
      }

      // Persist observations
      for (const obs of this.session.observations) {
        await prisma.aIObservationRecord.upsert({
          where: { id: obs.id },
          create: {
            id: obs.id,
            sessionId: this.session.id,
            severity: obs.severity,
            category: obs.category,
            title: obs.title,
            insight: obs.insight,
            suggestedActions: JSON.stringify(obs.suggestedActions),
            affectedPackageIds: JSON.stringify(obs.affectedWorkPackages),
            affectedItemIds: JSON.stringify(obs.affectedLineItems),
            extractedBy: obs.extraction.extractedBy,
            confidence: obs.extraction.confidence.overall,
          },
          update: {
            insight: obs.insight,
            acknowledged: obs.userAcknowledged,
            userResponse: obs.userResponse,
            respondedAt: obs.userResponseAt,
          },
        });
      }
    } catch (error) {
      console.error('Failed to persist session:', error);
      // Don't throw - we don't want to fail extraction due to persistence issues
    }
  }

  private emitProgress(type: ProgressEvent['type'], data: unknown): void {
    if (this.progressCallback) {
      this.progressCallback({
        type,
        sessionId: this.session.id,
        data,
      });
    }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session state
   */
  getSession(): ExtractionSession {
    return this.session;
  }
}

/**
 * Factory function to create and run extraction
 */
export async function runExtraction(
  projectId: string,
  documentIds: string[],
  config?: Partial<ExtractionConfig>,
  progressCallback?: ProgressCallback
): Promise<ExtractionSession> {
  // Load documents from database
  const diagrams = await prisma.diagram.findMany({
    where: {
      id: { in: documentIds },
    },
  });

  const documents: ExtractionDocument[] = diagrams.map(d => ({
    id: d.id,
    name: d.fileName,
    url: d.fileUrl,
    type: (d.category as any) || 'design_drawings',
    mimeType: d.fileType,
  }));

  const orchestrator = new ExtractionOrchestrator(
    projectId,
    documents,
    { ...DEFAULT_EXTRACTION_CONFIG, ...config }
  );

  if (progressCallback) {
    orchestrator.setProgressCallback(progressCallback);
  }

  return orchestrator.run();
}
