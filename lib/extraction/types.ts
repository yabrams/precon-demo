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
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.5'
  | 'consensus'
  | 'human';

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
  maxPasses: 3,
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
  | 'pass_3_validating'
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

export interface GeminiReviewResponse {
  additions: GeminiRawLineItem[];
  modifications: {
    original_item_ref: string;
    changes: Partial<GeminiRawLineItem>;
    reason: string;
  }[];
  gaps_identified: string[];
  confidence_adjustments: {
    item_ref: string;
    new_confidence: 'high' | 'medium' | 'low';
    reason: string;
  }[];
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
