/**
 * Advanced Extraction System Types
 *
 * Core types for the multi-model work package extraction system.
 * Phase 1: Simplified 3-pass workflow with Gemini primary + Claude validation
 */

// ============================================================================
// MODEL IDENTIFIERS
// ============================================================================

export type ModelIdentifier =
  | 'gemini-2.5-pro'
  | 'gemini-3-pro-preview'
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.5'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'consensus'
  | 'human';

// Model configuration for API calls
export const MODEL_CONFIGS: Record<string, { apiModel: string; provider: 'google' | 'anthropic' | 'openai' }> = {
  'gemini-2.5-pro': { apiModel: 'gemini-2.5-pro', provider: 'google' },
  'gemini-3-pro-preview': { apiModel: 'gemini-3-pro-preview', provider: 'google' },
  'claude-sonnet-4.5': { apiModel: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  'claude-opus-4.5': { apiModel: 'claude-opus-4-5-20251001', provider: 'anthropic' },
  'gpt-4o': { apiModel: 'gpt-4o', provider: 'openai' },
  'gpt-4o-mini': { apiModel: 'gpt-4o-mini', provider: 'openai' },
  'o1': { apiModel: 'o1', provider: 'openai' },
};

// Model pricing per 1M tokens (as of Jan 2025)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-3-pro-preview': { input: 2.00, output: 15.00 },
  'claude-sonnet-4.5': { input: 3.00, output: 15.00 },
  'claude-opus-4.5': { input: 15.00, output: 75.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o1': { input: 15.00, output: 60.00 },
};

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export type DocumentType =
  | 'design_drawings'
  | 'specifications'
  | 'addendum'
  | 'bid_form'
  | 'geotechnical'
  | 'permits'
  | 'contracts'
  | 'schedules'
  | 'details'
  | 'other';

export type DocumentRelationshipType =
  | 'defined_at'
  | 'modified_by'
  | 'clarified_in'
  | 'quantity_from'
  | 'detail_at'
  | 'schedule_in'
  | 'spec_section'
  | 'superseded_by'
  | 'conflicts_with';

export interface BoundingBox {
  x: number;      // Normalized 0-1, left edge
  y: number;      // Normalized 0-1, top edge
  width: number;  // Normalized 0-1
  height: number; // Normalized 0-1
}

export interface TextRange {
  startLine: number;
  endLine: number;
  startChar?: number;
  endChar?: number;
  highlightText: string;
}

export interface DocumentLocation {
  documentId: string;
  documentName: string;
  documentType: DocumentType;
  pageNumber: number;
  sheetNumber?: string;
  boundingBox?: BoundingBox;
  textRange?: TextRange;
  extractedText?: string;
  thumbnailUrl?: string;
}

export interface DocumentReference {
  id: string;
  location: DocumentLocation;
  relationshipType: DocumentRelationshipType;
  confidence: number;
  extractedBy: ModelIdentifier;
  reasoning?: string;
  displayLabel: string;
  previewSnippet?: string;
}

// ============================================================================
// EXTRACTION INPUT
// ============================================================================

export interface ExtractionDocument {
  id: string;
  name: string;
  url: string;
  type: DocumentType;
  mimeType: string;
  pageCount?: number;
}

export interface ExtractionConfig {
  primaryModel: ModelIdentifier;
  validationModel?: ModelIdentifier;
  enableIterativeRefinement: boolean;
  maxPasses: number;
  enableCrossModelValidation: boolean;
  focusTrades?: string[];
  skipTrades?: string[];
  minimumConfidence: number;
  flagThreshold: number;
}

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  primaryModel: 'gemini-2.5-pro',
  validationModel: 'claude-sonnet-4.5',
  enableIterativeRefinement: true,
  maxPasses: 5,
  enableCrossModelValidation: true,
  minimumConfidence: 0.5,
  flagThreshold: 0.7,
};

// ============================================================================
// CSI CLASSIFICATION
// ============================================================================

export interface CSIClassification {
  divisionCode: string;
  divisionName: string;
  sectionCode?: string;
  sectionName?: string;
  level: 1 | 2 | 3 | 4;
  confidence: number;
  reasoning: string;
  alternativeClassifications?: {
    code: string;
    name: string;
    confidence: number;
    reasoning: string;
  }[];
}

// ============================================================================
// EXTRACTED DATA
// ============================================================================

export interface ExtractedLineItem {
  id: string;
  itemNumber?: string;
  description: string;
  action: string;
  quantity?: number;
  unit?: string;
  quantityNotes?: string;
  specifications?: string;
  notes?: string;
  references: DocumentReference[];
  primaryReferenceId?: string;
  extraction: ExtractionMetadata;
  order: number;
}

export interface ExtractedWorkPackage {
  id: string;
  packageId: string;
  name: string;
  description?: string;
  csiClassification: CSIClassification;
  trade: string;
  scopeResponsible?: string;
  lineItems: ExtractedLineItem[];
  itemCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  keyDocuments: DocumentReference[];
  extraction: ExtractionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CONFIDENCE & METADATA
// ============================================================================

export interface ConfidenceFlag {
  type: 'warning' | 'info' | 'error';
  code: string;
  message: string;
  affectedFields?: string[];
  suggestedAction?: string;
}

export interface ConfidenceScore {
  overall: number;
  components: {
    dataCompleteness: number;
    sourceClarity: number;
    crossReferenceMatch: number;
    specificationMatch: number;
    quantityReasonableness: number;
  };
  reasoning: string;
  flags: ConfidenceFlag[];
}

export interface ExtractionMetadata {
  extractedBy: ModelIdentifier;
  extractedAt: Date;
  confidence: ConfidenceScore;
  verifiedBy?: ModelIdentifier[];
  humanReviewed: boolean;
  humanReviewedBy?: string;
  humanReviewedAt?: Date;
  extractionPass: number;
  refinedInPass?: number[];
}

// ============================================================================
// AI OBSERVATIONS
// ============================================================================

export type ObservationSeverity = 'critical' | 'warning' | 'info';

export type ObservationCategory =
  | 'scope_conflict'
  | 'specification_mismatch'
  | 'quantity_concern'
  | 'coordination_required'
  | 'addendum_impact'
  | 'warranty_requirement'
  | 'code_compliance'
  | 'risk_flag'
  | 'cost_impact'
  | 'schedule_impact'
  | 'missing_information'
  | 'substitution_available';

export interface AIObservation {
  id: string;
  severity: ObservationSeverity;
  category: ObservationCategory;
  title: string;
  insight: string;
  affectedWorkPackages: string[];
  affectedLineItems?: string[];
  references: DocumentReference[];
  suggestedActions?: string[];
  extraction: ExtractionMetadata;
  userAcknowledged?: boolean;
  userResponse?: string;
  userResponseAt?: Date;
}

// ============================================================================
// EXTRACTION SESSION
// ============================================================================

export type ExtractionStatus =
  | 'initializing'
  | 'pass_1_extracting'
  | 'pass_2_reviewing'
  | 'pass_3_deep_dive'
  | 'pass_4_validating'
  | 'pass_5_final'
  | 'awaiting_review'
  | 'completed'
  | 'failed';

export interface ExtractionPass {
  passNumber: number;
  model: ModelIdentifier;
  purpose: string;
  startedAt: Date;
  completedAt?: Date;
  newItemsFound: number;
  itemsModified: number;
  observationsAdded: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
}

export interface ExtractionMetrics {
  totalWorkPackages: number;
  totalLineItems: number;
  totalObservations: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  csiDivisionsCovered: string[];
  documentsProcessed: number;
  pagesProcessed: number;
  itemsNeedingReview: number;
  criticalObservations: number;
  warningObservations: number;
}

export interface ExtractionSession {
  id: string;
  projectId: string;
  config: ExtractionConfig;
  documents: ExtractionDocument[];
  workPackages: ExtractedWorkPackage[];
  observations: AIObservation[];
  metrics: ExtractionMetrics;
  passes: ExtractionPass[];
  status: ExtractionStatus;
  currentPass: number;
  progress: number;
  statusMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface StartExtractionRequest {
  projectId: string;
  documentIds: string[];
  config?: Partial<ExtractionConfig>;
}

export interface StartExtractionResponse {
  sessionId: string;
  status: ExtractionStatus;
  estimatedDuration: number;
}

export interface ExtractionStatusResponse {
  sessionId: string;
  status: ExtractionStatus;
  currentPass: number;
  progress: number;
  statusMessage?: string;
  metrics?: ExtractionMetrics;
  lastUpdate: Date;
}

export interface ExtractionResultsResponse {
  sessionId: string;
  status: ExtractionStatus;
  workPackages: ExtractedWorkPackage[];
  observations: AIObservation[];
  metrics: ExtractionMetrics;
  passes: ExtractionPass[];
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export type WSEventType =
  | 'status_update'
  | 'pass_complete'
  | 'item_found'
  | 'observation_added'
  | 'extraction_complete'
  | 'error';

export interface WSMessage {
  type: WSEventType;
  sessionId: string;
  timestamp: Date;
  payload: unknown;
}

export interface StatusUpdatePayload {
  status: ExtractionStatus;
  currentPass: number;
  progress: number;
  message: string;
}

export interface ItemFoundPayload {
  workPackageId: string;
  workPackageName: string;
  item: {
    id: string;
    description: string;
    action: string;
  };
  isNew: boolean;
}

export interface ObservationAddedPayload {
  observation: AIObservation;
}

export interface PassCompletePayload {
  passNumber: number;
  newItems: number;
  modifiedItems: number;
  observations: number;
  duration: number;
}

// ============================================================================
// RAW MODEL RESPONSES (for parsing)
// ============================================================================

export interface GeminiRawWorkPackage {
  packageId: string;
  name: string;
  csi_division: string;
  trade: string;
  description?: string;
  scope_responsible?: string;
  line_items: GeminiRawLineItem[];
}

export interface GeminiRawLineItem {
  item_number?: string;
  description: string;
  action: string;
  quantity?: number;
  unit?: string;
  specifications?: string;
  notes?: string;
  source_reference?: {
    sheet?: string;
    location?: string;
    page?: number;
  };
  flags?: string[];
}

// AI Observation from Gemini extraction
export interface GeminiAIObservation {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  insight: string;
  affected_packages?: string[];
  affected_line_items?: string[];
  source_reference?: {
    sheet?: string;
    page?: number;
    bounding_box?: [number, number, number, number];
    text_excerpt?: string;
  };
  suggested_actions?: string[];
}

export interface GeminiExtractionResponse {
  project_name?: string;
  work_packages: GeminiRawWorkPackage[];
  incomplete_areas?: string[];
  extraction_notes?: string;
  ai_observations?: GeminiAIObservation[];
  extraction_confidence?: number;
}

export interface GeminiReviewAddition extends GeminiRawLineItem {
  work_package: string; // Which package to add to
  confidence?: number;
  reason_missed?: string;
}

export interface GeminiReviewResponse {
  additions: GeminiReviewAddition[];
  modifications: {
    original_item_ref: string;
    changes: Partial<GeminiRawLineItem>;
    reason: string;
  }[];
  new_packages?: GeminiRawWorkPackage[];
  gaps_identified: string[];
  confidence_adjustments: {
    item_ref: string;
    previous_confidence?: number;
    new_confidence: 'high' | 'medium' | 'low' | number;
    reason: string;
  }[];
  ai_observations?: GeminiAIObservation[];
  overall_assessment?: {
    extraction_completeness: number;
    data_quality: number;
    risk_level: 'low' | 'medium' | 'high';
    summary: string;
  };
}

export interface ClaudeValidationResponse {
  validated_packages: {
    packageId: string;
    confidence: number;
    confidence_reasoning: string;
    flags: ConfidenceFlag[];
  }[];
  observations: {
    severity: ObservationSeverity;
    category: ObservationCategory;
    title: string;
    insight: string;
    affected_packages: string[];
    affected_items?: string[];
    suggested_actions?: string[];
  }[];
  overall_assessment: {
    completeness: number;
    accuracy_estimate: number;
    items_needing_review: string[];
    critical_issues: string[];
  };
}

// ============================================================================
// PERMUTATION TESTING TYPES
// ============================================================================

/**
 * Configuration for a single pass in the extraction workflow
 */
export interface PassConfig {
  passNumber: number;
  model: ModelIdentifier;
  purpose: 'initial_extraction' | 'self_review' | 'trade_deep_dive' | 'cross_validation' | 'final_validation';
  dependsOnPasses: number[]; // Which previous passes this depends on
}

/**
 * Configuration for a complete permutation test
 */
export interface PermutationConfig {
  id: string;
  name: string;
  description: string;
  passes: PassConfig[];
  expectedCost?: number; // Estimated cost in USD
}

/**
 * Result of a single pass execution
 */
export interface PassResult {
  passNumber: number;
  model: ModelIdentifier;
  purpose: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number; // Calculated cost in USD
  response: GeminiExtractionResponse | GeminiReviewResponse | ClaudeValidationResponse;
  cacheHit: boolean; // Whether this result was from cache
  cacheKey?: string;
}

/**
 * Complete result of a permutation test
 */
export interface PermutationResult {
  permutationId: string;
  permutationName: string;
  config: PermutationConfig;
  documentHash: string; // Hash of input documents for cache key
  passes: PassResult[];
  finalResult: {
    workPackages: GeminiRawWorkPackage[];
    observations: GeminiAIObservation[];
    totalLineItems: number;
    totalObservations: number;
  };
  metrics: {
    totalDurationMs: number;
    totalTokens: { input: number; output: number };
    totalCost: number;
    cacheHits: number;
    apiCalls: number;
  };
  startedAt: Date;
  completedAt: Date;
}

/**
 * Cache entry for a pass result
 */
export interface PassCacheEntry {
  cacheKey: string;
  passNumber: number;
  model: ModelIdentifier;
  purpose: string;
  documentHash: string;
  previousPassHashes: string[]; // Hashes of dependent pass results
  promptVersion: string; // Version of the prompt used
  result: PassResult;
  createdAt: Date;
}

/**
 * Summary for comparison report
 */
export interface PermutationComparison {
  permutations: PermutationResult[];
  lineItemComparison: {
    itemKey: string; // e.g., "MEC.RTU-1" or description hash
    description: string;
    byPermutation: {
      [permutationId: string]: {
        found: boolean;
        quantity?: number;
        unit?: string;
        confidence?: number;
        passFound?: number; // Which pass found this item
      };
    };
  }[];
  observationComparison: {
    observationKey: string;
    title: string;
    byPermutation: {
      [permutationId: string]: {
        found: boolean;
        severity?: string;
        category?: string;
        passFound?: number;
      };
    };
  }[];
  incrementalValueAnalysis: {
    permutationId: string;
    byPass: {
      passNumber: number;
      model: ModelIdentifier;
      newItemsFound: number;
      itemsModified: number;
      newObservations: number;
      costForPass: number;
      valueScore: number; // items found per dollar
    }[];
  }[];
  recommendations: string[];
  generatedAt: Date;
}
