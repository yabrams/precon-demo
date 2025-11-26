# Advanced Multi-Model Work Package Extraction System

## Executive Summary

This document outlines the architecture for a next-generation AI-powered extraction system that leverages multiple LLMs (Claude, Gemini) in a coordinated workflow to extract, validate, and refine construction work packages from project documents. The system implements iterative refinement, cross-model validation, and comprehensive traceability for both real-time operations and future ML improvements.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Data Structures](#2-data-structures)
3. [Extraction Workflow](#3-extraction-workflow)
4. [API Design](#4-api-design)
5. [Prompt Engineering](#5-prompt-engineering)
6. [Model Orchestration](#6-model-orchestration)
7. [UI/UX Considerations](#7-uiux-considerations)
8. [Phase 2: Learning & Optimization](#8-phase-2-learning--optimization)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT INGESTION LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Upload → Parse → Classify → Index                                          │
│  • PDF/Image processing                                                      │
│  • Document type detection (Plans, Specs, Addenda, SOW, Schedules)          │
│  • Page-level metadata extraction                                            │
│  • Text/Visual content separation                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-MODEL EXTRACTION ENGINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   GEMINI     │    │   CLAUDE     │    │   FUTURE     │                  │
│  │   Pro 2.5    │    │   Sonnet     │    │   MODELS     │                  │
│  │              │    │   4.5        │    │              │                  │
│  │ • PDF Native │    │ • Vision     │    │ • GPT-4o    │                  │
│  │ • Long ctx   │    │ • Reasoning  │    │ • Llama     │                  │
│  │ • Multi-doc  │    │ • JSON       │    │ • etc.      │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             ↓                                                │
│              ┌──────────────────────────────┐                               │
│              │     ORCHESTRATION LAYER      │                               │
│              │  • Workflow sequencing       │                               │
│              │  • Cross-model conversation  │                               │
│              │  • Consensus building        │                               │
│              │  • Conflict resolution       │                               │
│              └──────────────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VALIDATION & ENRICHMENT                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  • CSI Code mapping & validation                                             │
│  • Quantity cross-checking                                                   │
│  • Specification compliance verification                                     │
│  • Risk/concern identification                                               │
│  • Document reference linking                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT & STORAGE LAYER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Work packages with full traceability                                      │
│  • AI observations & risk flags                                              │
│  • Confidence scores with reasoning                                          │
│  • Document references (page, location, bounding box)                       │
│  • Prediction vs. final outcome tracking                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

1. **Multi-Model Orchestration**: Different models have different strengths
   - Gemini: Excellent at PDF parsing, long context, multi-document reasoning
   - Claude: Superior structured output, reasoning transparency, JSON reliability

2. **Iterative Refinement**: Each pass surfaces new insights
   - Pass 1: Initial extraction from primary document
   - Pass 2: Self-review ("What did I miss?")
   - Pass 3: Trade-by-trade deep dive
   - Pass 4: Cross-document correlation
   - Pass 5: Validation and risk assessment

3. **Full Traceability**: Every extracted item links to source
   - Document reference (which file)
   - Page/sheet reference
   - Bounding box or text range
   - Relationship type (defined_at, modified_by, clarified_in, etc.)

4. **Learning-Ready Architecture**: Data structured for future optimization
   - Predicted values stored separately from final values
   - Confidence scores with reasoning
   - User corrections tracked with context

---

## 2. Data Structures

### 2.1 Core Extraction Types

```typescript
// ============================================================================
// DOCUMENT REFERENCE TYPES
// ============================================================================

/**
 * Types of relationships between work items and document sources
 */
type DocumentRelationshipType =
  | 'defined_at'        // Primary definition location
  | 'modified_by'       // Addendum or change that modifies scope
  | 'clarified_in'      // Additional specification details
  | 'quantity_from'     // Source of quantity takeoff
  | 'detail_at'         // Detail drawing reference
  | 'schedule_in'       // Equipment schedule reference
  | 'spec_section'      // Specification section reference
  | 'superseded_by'     // Previous version superseded
  | 'conflicts_with';   // Identified conflict

/**
 * Precise location within a document
 */
interface DocumentLocation {
  // Document identification
  documentId: string;           // Internal document ID
  documentName: string;         // Human-readable name (e.g., "2032_kenai_rec_center_upgrades_100.pdf")
  documentType: DocumentType;   // Type classification

  // Page/Sheet location
  pageNumber: number;           // 1-indexed page number
  sheetNumber?: string;         // Drawing sheet number (e.g., "E1.0", "M0.1")

  // Precise location within page
  boundingBox?: BoundingBox;    // For visual elements (drawings)
  textRange?: TextRange;        // For text content (specs)

  // Extraction context
  extractedText?: string;       // The actual text extracted (for specs)
  thumbnailUrl?: string;        // Pre-rendered thumbnail of the area
}

interface BoundingBox {
  x: number;      // Normalized 0-1, left edge
  y: number;      // Normalized 0-1, top edge
  width: number;  // Normalized 0-1
  height: number; // Normalized 0-1
}

interface TextRange {
  startLine: number;
  endLine: number;
  startChar?: number;
  endChar?: number;
  highlightText: string;  // The specific text to highlight
}

/**
 * A reference linking a work item to its source document(s)
 */
interface DocumentReference {
  id: string;
  location: DocumentLocation;
  relationshipType: DocumentRelationshipType;
  confidence: number;           // 0-1 confidence in this reference
  extractedBy: ModelIdentifier; // Which model found this
  reasoning?: string;           // Why this reference is relevant

  // For UI display
  displayLabel: string;         // e.g., "Sheet E1.0 - Panel Schedule"
  previewSnippet?: string;      // Short preview text
}

type DocumentType =
  | 'design_drawings'    // Architectural, structural, MEP drawings
  | 'specifications'     // Project manual, specs
  | 'addendum'           // Change documents
  | 'bid_form'           // Bid forms, schedules of values
  | 'geotechnical'       // Soil reports, surveys
  | 'permits'            // Permit documents
  | 'contracts'          // ITB, contracts, general conditions
  | 'schedules'          // Equipment schedules, fixture schedules
  | 'details'            // Detail sheets
  | 'other';

// ============================================================================
// WORK PACKAGE TYPES
// ============================================================================

/**
 * CSI MasterFormat classification with confidence
 */
interface CSIClassification {
  divisionCode: string;         // e.g., "26" for Electrical
  divisionName: string;         // e.g., "Electrical"
  sectionCode?: string;         // e.g., "26 24 00"
  sectionName?: string;         // e.g., "Switchboards and Panelboards"
  level: 1 | 2 | 3 | 4;        // Classification depth
  confidence: number;           // 0-1
  reasoning: string;            // Why this classification
  alternativeClassifications?: {
    code: string;
    name: string;
    confidence: number;
    reasoning: string;
  }[];
}

/**
 * A single line item within a work package
 */
interface ExtractedLineItem {
  id: string;

  // Core item data
  itemNumber?: string;          // e.g., "MEC-01"
  description: string;          // Full description
  action: string;               // e.g., "Install", "Replace", "Demo"

  // Quantities
  quantity?: number;
  unit?: string;                // e.g., "SF", "LF", "EA"
  quantityNotes?: string;       // Additional context

  // Specifications
  specifications?: string;      // Technical specs
  notes?: string;

  // Source references (CRITICAL for traceability)
  references: DocumentReference[];
  primaryReference?: string;    // ID of the primary reference

  // Extraction metadata
  extraction: ExtractionMetadata;

  // For UI ordering
  order: number;
}

/**
 * A work package (scope of work for a trade/CSI division)
 */
interface ExtractedWorkPackage {
  id: string;

  // Package identification
  packageId: string;            // e.g., "MEC", "ELE", "CIV"
  name: string;                 // e.g., "Mechanical - HVAC Equipment"
  description?: string;

  // CSI Classification
  csiClassification: CSIClassification;

  // Trade assignment
  trade: string;                // e.g., "Mechanical", "Electrical"
  scopeResponsible?: string;    // e.g., "HVAC Contractor"

  // Line items
  lineItems: ExtractedLineItem[];

  // Summary metrics
  itemCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high';

  // Package-level references
  keyDocuments: DocumentReference[];

  // Extraction metadata
  extraction: ExtractionMetadata;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EXTRACTION METADATA & CONFIDENCE
// ============================================================================

type ModelIdentifier =
  | 'gemini-2.5-pro'
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.5'
  | 'gpt-4o'
  | 'consensus'         // Agreed by multiple models
  | 'human';            // Human verified/corrected

interface ExtractionMetadata {
  // Primary model that extracted this
  extractedBy: ModelIdentifier;
  extractedAt: Date;

  // Confidence scoring
  confidence: ConfidenceScore;

  // Verification status
  verifiedBy?: ModelIdentifier[];   // Other models that confirmed
  humanReviewed: boolean;
  humanReviewedBy?: string;
  humanReviewedAt?: Date;

  // Iteration tracking
  extractionPass: number;           // Which pass (1-5)
  refinedInPass?: number[];         // Later passes that refined this

  // Model conversation (for multi-model flow)
  modelConversation?: ModelExchange[];
}

interface ConfidenceScore {
  overall: number;                  // 0-1 composite score

  // Component scores
  components: {
    dataCompleteness: number;       // Are all fields populated?
    sourceClarity: number;          // How clear was the source?
    crossReferenceMatch: number;    // Do multiple sources agree?
    specificationMatch: number;     // Does it match specs?
    quantityReasonableness: number; // Is quantity reasonable?
  };

  // Reasoning
  reasoning: string;

  // Flags that affect confidence
  flags: ConfidenceFlag[];
}

interface ConfidenceFlag {
  type: 'warning' | 'info' | 'error';
  code: string;                     // e.g., "QUANTITY_MISMATCH"
  message: string;
  affectedFields?: string[];
  suggestedAction?: string;
}

/**
 * Record of exchange between models
 */
interface ModelExchange {
  id: string;
  timestamp: Date;
  fromModel: ModelIdentifier;
  toModel: ModelIdentifier;
  exchangeType: 'initial_extraction' | 'validation' | 'refinement' | 'conflict_resolution';

  // The actual exchange
  prompt: string;
  response: string;

  // What changed as a result
  changes?: {
    field: string;
    previousValue: any;
    newValue: any;
    reasoning: string;
  }[];
}

// ============================================================================
// AI OBSERVATIONS & INSIGHTS
// ============================================================================

type ObservationSeverity = 'critical' | 'warning' | 'info';
type ObservationCategory =
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

/**
 * AI-generated observation or insight
 */
interface AIObservation {
  id: string;

  // Classification
  severity: ObservationSeverity;
  category: ObservationCategory;

  // Content
  title: string;                    // Brief title
  insight: string;                  // Detailed explanation

  // What it affects
  affectedWorkPackages: string[];   // Work package IDs
  affectedLineItems?: string[];     // Specific line items

  // Source references
  references: DocumentReference[];

  // Suggested actions
  suggestedActions?: string[];

  // Extraction metadata
  extraction: ExtractionMetadata;

  // User response tracking
  userAcknowledged?: boolean;
  userResponse?: string;
  userResponseAt?: Date;
}

// ============================================================================
// EXTRACTION SESSION & RESULTS
// ============================================================================

/**
 * Configuration for an extraction session
 */
interface ExtractionConfig {
  // Model selection
  primaryModel: ModelIdentifier;
  validationModel?: ModelIdentifier;

  // Workflow options
  enableIterativeRefinement: boolean;
  maxPasses: number;                // Usually 3-5
  enableCrossModelValidation: boolean;

  // Focus options
  focusTrades?: string[];           // Only extract specific trades
  skipTrades?: string[];            // Exclude certain trades

  // Quality thresholds
  minimumConfidence: number;        // Minimum confidence to include
  flagThreshold: number;            // Below this, flag for review
}

/**
 * Complete extraction session result
 */
interface ExtractionSession {
  id: string;
  projectId: string;

  // Configuration used
  config: ExtractionConfig;

  // Input documents
  documents: {
    id: string;
    name: string;
    type: DocumentType;
    pageCount: number;
    uploadedAt: Date;
  }[];

  // Extraction results
  workPackages: ExtractedWorkPackage[];
  observations: AIObservation[];

  // Summary metrics
  metrics: ExtractionMetrics;

  // Processing history
  passes: ExtractionPass[];

  // Status
  status: 'processing' | 'completed' | 'failed' | 'review_required';

  // Timestamps
  startedAt: Date;
  completedAt?: Date;
}

interface ExtractionMetrics {
  totalWorkPackages: number;
  totalLineItems: number;
  totalObservations: number;

  // Confidence distribution
  confidenceDistribution: {
    high: number;     // > 0.8
    medium: number;   // 0.5 - 0.8
    low: number;      // < 0.5
  };

  // Coverage
  csiDivisionsCovered: string[];
  documentsProcessed: number;
  pagesProcessed: number;

  // Quality indicators
  itemsNeedingReview: number;
  criticalObservations: number;
  warningObservations: number;
}

interface ExtractionPass {
  passNumber: number;
  model: ModelIdentifier;
  purpose: string;              // e.g., "Initial extraction", "Trade deep-dive"

  startedAt: Date;
  completedAt?: Date;

  // What was found/changed
  newItemsFound: number;
  itemsModified: number;
  observationsAdded: number;

  // Token usage (for cost tracking)
  tokensUsed?: {
    input: number;
    output: number;
  };
}

// ============================================================================
// PHASE 2: LEARNING & OPTIMIZATION TYPES
// ============================================================================

/**
 * Record of model prediction vs human-verified outcome
 * Used for confidence calibration and model improvement
 */
interface PredictionRecord {
  id: string;
  sessionId: string;

  // The prediction
  predictedValue: {
    entityType: 'work_package' | 'line_item' | 'observation';
    entityId: string;
    field: string;
    value: any;
    confidence: number;
    model: ModelIdentifier;
  };

  // The final outcome
  finalValue?: {
    value: any;
    source: 'human_correction' | 'model_refinement' | 'consensus';
    correctedBy?: string;       // User ID if human
    correctedAt?: Date;
  };

  // Analysis
  wasCorrect?: boolean;
  errorMagnitude?: number;      // For numeric values
  errorCategory?: string;       // Type of error

  // Context for learning
  context: {
    documentTypes: DocumentType[];
    projectType?: string;
    region?: string;
    totalProjectValue?: number;
  };

  createdAt: Date;
}

/**
 * Aggregated confidence calibration data
 */
interface ConfidenceCalibration {
  model: ModelIdentifier;
  entityType: 'work_package' | 'line_item' | 'observation';
  field: string;

  // Calibration data
  bins: {
    predictedConfidenceRange: [number, number];  // e.g., [0.8, 0.9]
    actualAccuracy: number;                       // Actual accuracy in this bin
    sampleCount: number;
  }[];

  // Overall metrics
  brierScore: number;           // Lower is better
  calibrationError: number;     // Average |predicted - actual|

  lastUpdated: Date;
}
```

### 2.2 Database Schema Extensions

```prisma
// Add to schema.prisma

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

model ProjectDocument {
  id              String                    @id @default(cuid())
  projectId       String
  project         BuildingConnectedProject  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // File info
  fileName        String
  fileUrl         String
  fileType        String
  fileSize        Int
  fileHash        String?                   @unique

  // Classification
  documentType    String                    // DocumentType enum value
  category        String?                   // More specific category

  // Processing status
  pageCount       Int?
  processedAt     DateTime?
  ocrText         String?                   @db.Text

  // Metadata extracted
  sheetNumbers    String?                   @db.Text  // JSON array of sheet numbers
  metadata        String?                   @db.Text  // JSON object

  uploadedAt      DateTime                  @default(now())
  uploadedBy      String?

  // Relations
  references      DocumentReferenceRecord[]

  @@index([projectId])
  @@index([documentType])
}

model DocumentReferenceRecord {
  id              String          @id @default(cuid())

  // Source document
  documentId      String
  document        ProjectDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  // Location within document
  pageNumber      Int
  sheetNumber     String?
  boundingBox     String?         @db.Text  // JSON BoundingBox
  textRange       String?         @db.Text  // JSON TextRange

  // Reference details
  relationshipType String         // DocumentRelationshipType
  displayLabel    String
  previewSnippet  String?         @db.Text
  thumbnailUrl    String?

  // What this references
  workPackageId   String?
  lineItemId      String?
  observationId   String?

  // Extraction info
  extractedBy     String          // ModelIdentifier
  confidence      Float
  reasoning       String?         @db.Text

  createdAt       DateTime        @default(now())

  @@index([documentId])
  @@index([workPackageId])
  @@index([lineItemId])
}

// ============================================================================
// EXTRACTION SESSION
// ============================================================================

model ExtractionSession {
  id              String                    @id @default(cuid())
  projectId       String
  project         BuildingConnectedProject  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Configuration
  config          String                    @db.Text  // JSON ExtractionConfig

  // Status
  status          String                    @default("processing")

  // Metrics
  metrics         String?                   @db.Text  // JSON ExtractionMetrics

  // Processing history
  passes          String?                   @db.Text  // JSON ExtractionPass[]

  // Timestamps
  startedAt       DateTime                  @default(now())
  completedAt     DateTime?

  // Relations
  workPackages    ExtractedWorkPackageRecord[]
  observations    AIObservationRecord[]
  predictions     PredictionRecord[]

  @@index([projectId])
  @@index([status])
}

model ExtractedWorkPackageRecord {
  id                  String            @id @default(cuid())
  sessionId           String
  session             ExtractionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Package data
  packageId           String
  name                String
  description         String?           @db.Text
  trade               String
  scopeResponsible    String?

  // CSI Classification
  csiDivisionCode     String
  csiDivisionName     String
  csiSectionCode      String?
  csiSectionName      String?
  csiConfidence       Float
  csiReasoning        String?           @db.Text

  // Metrics
  itemCount           Int
  complexity          String            // low, medium, high

  // Extraction metadata
  extractedBy         String
  extractionPass      Int
  confidence          Float
  confidenceDetails   String?           @db.Text  // JSON ConfidenceScore

  // Relations
  lineItems           ExtractedLineItemRecord[]

  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@index([sessionId])
  @@index([csiDivisionCode])
  @@index([trade])
}

model ExtractedLineItemRecord {
  id                  String                      @id @default(cuid())
  workPackageId       String
  workPackage         ExtractedWorkPackageRecord  @relation(fields: [workPackageId], references: [id], onDelete: Cascade)

  // Item data
  itemNumber          String?
  description         String
  action              String
  quantity            Float?
  unit                String?
  specifications      String?           @db.Text
  notes               String?           @db.Text

  // Ordering
  orderIndex          Int

  // Extraction metadata
  extractedBy         String
  extractionPass      Int
  confidence          Float
  confidenceDetails   String?           @db.Text

  // Human review
  humanReviewed       Boolean           @default(false)
  humanReviewedBy     String?
  humanReviewedAt     DateTime?
  humanCorrections    String?           @db.Text  // JSON of corrections

  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@index([workPackageId])
}

model AIObservationRecord {
  id                  String            @id @default(cuid())
  sessionId           String
  session             ExtractionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Classification
  severity            String            // critical, warning, info
  category            String            // ObservationCategory

  // Content
  title               String
  insight             String            @db.Text
  suggestedActions    String?           @db.Text  // JSON array

  // What it affects
  affectedPackageIds  String?           @db.Text  // JSON array
  affectedItemIds     String?           @db.Text  // JSON array

  // Extraction metadata
  extractedBy         String
  confidence          Float

  // User response
  acknowledged        Boolean           @default(false)
  userResponse        String?           @db.Text
  respondedAt         DateTime?
  respondedBy         String?

  createdAt           DateTime          @default(now())

  @@index([sessionId])
  @@index([severity])
  @@index([category])
}

// ============================================================================
// PHASE 2: LEARNING & OPTIMIZATION
// ============================================================================

model PredictionRecord {
  id                  String            @id @default(cuid())
  sessionId           String
  session             ExtractionSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Prediction details
  entityType          String            // work_package, line_item, observation
  entityId            String
  fieldName           String
  predictedValue      String            @db.Text  // JSON
  predictedConfidence Float
  predictedBy         String            // ModelIdentifier

  // Final outcome
  finalValue          String?           @db.Text  // JSON
  finalSource         String?           // human_correction, model_refinement, consensus
  correctedBy         String?
  correctedAt         DateTime?

  // Analysis
  wasCorrect          Boolean?
  errorMagnitude      Float?
  errorCategory       String?

  // Context
  contextData         String?           @db.Text  // JSON context

  createdAt           DateTime          @default(now())

  @@index([sessionId])
  @@index([entityType])
  @@index([predictedBy])
  @@index([wasCorrect])
}

model ConfidenceCalibrationRecord {
  id                  String            @id @default(cuid())

  // Dimensions
  model               String
  entityType          String
  fieldName           String

  // Calibration data
  calibrationData     String            @db.Text  // JSON bins array
  brierScore          Float
  calibrationError    Float
  sampleCount         Int

  lastUpdated         DateTime          @default(now())

  @@unique([model, entityType, fieldName])
  @@index([model])
}
```

---

## 3. Extraction Workflow

### 3.1 Five-Pass Extraction Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PASS 1: INITIAL EXTRACTION                                                   │
│ Model: Gemini 2.5 Pro (best at PDF parsing)                                 │
│                                                                              │
│ Input: Design drawings (primary document)                                    │
│ Output: Initial work packages by visible trades                             │
│                                                                              │
│ Prompt focus:                                                                │
│ - Identify all visible trades/CSI divisions                                  │
│ - Extract obvious line items with quantities                                │
│ - Note any sheet references, drawing numbers                                │
│ - Flag anything unclear or potentially incomplete                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PASS 2: SELF-REVIEW & GAP ANALYSIS                                          │
│ Model: Same as Pass 1 (Gemini)                                              │
│                                                                              │
│ Input: Pass 1 results + original document                                   │
│ Prompt: "Review your extraction. What did you miss? What needs more detail?"│
│                                                                              │
│ Output: Additional items, refined quantities, identified gaps               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PASS 3: TRADE-BY-TRADE DEEP DIVE                                            │
│ Model: Gemini 2.5 Pro                                                       │
│                                                                              │
│ For each identified trade/CSI division:                                     │
│ - Focus extraction on ONLY that trade                                       │
│ - Build comprehensive table                                                  │
│ - Cross-reference all sheets for that trade                                 │
│                                                                              │
│ Output: Detailed work packages per trade (often 2x items vs initial)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PASS 4: CROSS-DOCUMENT CORRELATION                                          │
│ Model: Gemini (multi-doc) + Claude (validation)                             │
│                                                                              │
│ Input: ALL documents (specs, addenda, schedules, ITB)                       │
│ + Current extracted work packages                                            │
│                                                                              │
│ Process:                                                                     │
│ 1. Gemini reads additional docs, correlates with existing packages          │
│ 2. Identifies: additions, modifications, conflicts, new requirements        │
│ 3. Claude validates and structures the changes                              │
│                                                                              │
│ Output:                                                                      │
│ - Updated work packages with specification references                       │
│ - Change log (what was added/modified and why)                             │
│ - Document reference links                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PASS 5: VALIDATION & RISK ASSESSMENT                                        │
│ Model: Claude Sonnet 4.5 (best at reasoning/JSON)                           │
│                                                                              │
│ Input: Complete work packages + all documents                               │
│                                                                              │
│ Analysis:                                                                    │
│ 1. Quantity reasonableness checks                                           │
│    - Dimensions match quantities?                                           │
│    - Ratios between trades make sense? (e.g., plumbing vs electrical)      │
│                                                                              │
│ 2. Specification compliance                                                  │
│    - All spec requirements captured?                                        │
│    - Warranty requirements noted?                                           │
│                                                                              │
│ 3. Risk identification                                                       │
│    - Conflicts between documents                                            │
│    - Unclear scope boundaries                                               │
│    - Coordination requirements                                               │
│    - Change order risks                                                     │
│                                                                              │
│ Output:                                                                      │
│ - Final confidence scores                                                   │
│ - AI Observations (critical/warning/info)                                   │
│ - Items flagged for human review                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Workflow State Machine

```typescript
type WorkflowState =
  | 'initializing'
  | 'pass_1_extracting'
  | 'pass_2_reviewing'
  | 'pass_3_deep_dive'
  | 'pass_4_correlating'
  | 'pass_5_validating'
  | 'awaiting_review'
  | 'completed'
  | 'failed';

interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  trigger: string;
  guard?: (context: WorkflowContext) => boolean;
}

const workflowTransitions: WorkflowTransition[] = [
  { from: 'initializing', to: 'pass_1_extracting', trigger: 'documents_loaded' },
  { from: 'pass_1_extracting', to: 'pass_2_reviewing', trigger: 'pass_complete' },
  { from: 'pass_2_reviewing', to: 'pass_3_deep_dive', trigger: 'pass_complete' },
  { from: 'pass_3_deep_dive', to: 'pass_4_correlating', trigger: 'all_trades_complete' },
  { from: 'pass_4_correlating', to: 'pass_5_validating', trigger: 'correlation_complete' },
  { from: 'pass_5_validating', to: 'awaiting_review', trigger: 'has_critical_flags' },
  { from: 'pass_5_validating', to: 'completed', trigger: 'validation_passed' },
  { from: 'awaiting_review', to: 'completed', trigger: 'review_approved' },
  // Error handling
  { from: '*', to: 'failed', trigger: 'error' },
];
```

---

## 4. API Design

### 4.1 New API Routes

```typescript
// ============================================================================
// /api/extraction/start
// ============================================================================
// POST - Start a new extraction session
interface StartExtractionRequest {
  projectId: string;
  documentIds: string[];          // Documents to process
  config?: Partial<ExtractionConfig>;
}

interface StartExtractionResponse {
  sessionId: string;
  status: 'processing';
  estimatedDuration: number;      // seconds
  websocketUrl: string;           // For real-time updates
}

// ============================================================================
// /api/extraction/[sessionId]/status
// ============================================================================
// GET - Get extraction session status
interface ExtractionStatusResponse {
  sessionId: string;
  status: WorkflowState;
  currentPass: number;
  progress: {
    passProgress: number;         // 0-100
    overallProgress: number;      // 0-100
  };
  metrics?: ExtractionMetrics;
  lastUpdate: Date;
}

// ============================================================================
// /api/extraction/[sessionId]/results
// ============================================================================
// GET - Get extraction results (when completed)
interface ExtractionResultsResponse {
  sessionId: string;
  status: 'completed' | 'review_required';
  workPackages: ExtractedWorkPackage[];
  observations: AIObservation[];
  metrics: ExtractionMetrics;
  passes: ExtractionPass[];
}

// ============================================================================
// /api/extraction/[sessionId]/item/[itemId]/correct
// ============================================================================
// POST - Submit human correction for a line item
interface ItemCorrectionRequest {
  field: string;
  originalValue: any;
  correctedValue: any;
  reason?: string;
}

interface ItemCorrectionResponse {
  success: boolean;
  predictionRecordId: string;     // For tracking
}

// ============================================================================
// /api/extraction/[sessionId]/observation/[obsId]/respond
// ============================================================================
// POST - Respond to an AI observation
interface ObservationResponseRequest {
  acknowledged: boolean;
  response?: string;
  action?: 'accept' | 'dismiss' | 'investigate';
}

// ============================================================================
// /api/models/gemini
// ============================================================================
// POST - Call Gemini API directly
interface GeminiRequest {
  documents: {
    type: 'pdf' | 'image';
    url: string;
  }[];
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface GeminiResponse {
  text: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================================================
// /api/references/[itemId]
// ============================================================================
// GET - Get document references for a line item
interface ItemReferencesResponse {
  references: DocumentReference[];
  thumbnails: {
    referenceId: string;
    url: string;
    boundingBox?: BoundingBox;
  }[];
}
```

### 4.2 WebSocket Events (Real-time Updates)

```typescript
// Client → Server
interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe';
  sessionId: string;
}

// Server → Client
interface WSServerMessage {
  type: 'status_update' | 'pass_complete' | 'item_found' | 'observation_added' | 'error';
  sessionId: string;
  payload: any;
}

interface StatusUpdatePayload {
  state: WorkflowState;
  currentPass: number;
  progress: number;
  message: string;
}

interface ItemFoundPayload {
  workPackageId: string;
  item: ExtractedLineItem;
  isNew: boolean;
}

interface ObservationAddedPayload {
  observation: AIObservation;
}
```

---

## 5. Prompt Engineering

### 5.1 Pass 1: Initial Extraction Prompt

```typescript
const PASS_1_PROMPT = `
You are a senior preconstruction estimator analyzing construction documents.

TASK: Extract all work packages (scopes of work) from this construction document.

For each work package found, identify:
1. Trade/CSI Division (use MasterFormat classification)
2. Individual line items with:
   - Item description
   - Action (Install, Replace, Demo, etc.)
   - Quantity (if visible)
   - Unit of measure
   - Specifications/notes
   - Sheet/page reference where found

IMPORTANT INSTRUCTIONS:
- Be thorough - it's better to over-extract than miss items
- Include ALL visible trades, even if you see only one item
- Note quantities exactly as shown (don't calculate)
- Reference specific sheet numbers (e.g., "M0.1", "E3.0")
- Flag anything unclear with [NEEDS REVIEW]

OUTPUT FORMAT:
Return JSON matching this structure:
{
  "project_name": string,
  "work_packages": [
    {
      "packageId": string,           // e.g., "MEC", "ELE", "CIV"
      "name": string,                // e.g., "Mechanical - HVAC"
      "csi_division": string,        // e.g., "23"
      "trade": string,               // e.g., "Mechanical"
      "line_items": [
        {
          "item_number": string | null,
          "description": string,
          "action": string,
          "quantity": number | null,
          "unit": string | null,
          "specifications": string | null,
          "source_reference": {
            "sheet": string,         // e.g., "M0.1"
            "location": string       // e.g., "Equipment Schedule"
          },
          "flags": string[]          // e.g., ["NEEDS REVIEW"]
        }
      ]
    }
  ],
  "incomplete_areas": string[],      // Areas you couldn't fully extract
  "extraction_notes": string         // Any overall notes
}
`;
```

### 5.2 Pass 2: Self-Review Prompt

```typescript
const PASS_2_PROMPT = (previousExtraction: string) => `
You previously extracted the following work packages from this document:

${previousExtraction}

TASK: Review your extraction critically.

Consider:
1. Did you miss any trades/scopes visible in the document?
2. Are quantities complete? Look for:
   - Schedule tables (equipment schedules, fixture schedules)
   - Keynotes and legends
   - Detail callouts
3. Are there items that need splitting into multiple line items?
4. Did you capture all coordination items between trades?

SPECIFIC CHECKS:
- Count equipment items in schedules - do your counts match?
- Check for demolition items - often overlooked
- Look for "N.I.C." or "By Others" notes
- Check general notes for hidden requirements

OUTPUT FORMAT:
{
  "additions": [
    // New items to add
  ],
  "modifications": [
    {
      "original_item_ref": string,   // Reference to original item
      "changes": object,             // What changed
      "reason": string               // Why
    }
  ],
  "gaps_identified": string[],       // Things still unclear
  "confidence_adjustments": [
    {
      "item_ref": string,
      "new_confidence": "high" | "medium" | "low",
      "reason": string
    }
  ]
}
`;
```

### 5.3 Pass 3: Trade Deep-Dive Prompt

```typescript
const PASS_3_PROMPT = (trade: string, csiDivision: string) => `
FOCUS TASK: Extract ALL ${trade} (CSI Division ${csiDivision}) items from this document.

You must be EXHAUSTIVE. This is a focused deep-dive on a single trade.

For ${trade}, look for:
${getTradeSpecificChecklist(trade)}

Build a COMPLETE table of every ${trade.toLowerCase()} item including:
- Main equipment/systems
- Accessories and appurtenances
- Demolition of existing
- Connections and tie-ins
- Testing and commissioning
- Permits and inspections

Cross-reference ALL sheets that contain ${trade.toLowerCase()} scope:
- Plan sheets
- Detail sheets
- Schedule sheets
- Riser diagrams
- One-line diagrams (for electrical)

OUTPUT: Complete work package JSON for ${trade} only.
`;

function getTradeSpecificChecklist(trade: string): string {
  const checklists: Record<string, string> = {
    'Mechanical': `
- RTUs, AHUs, split systems
- Exhaust fans (all types)
- Ductwork (supply, return, exhaust)
- Diffusers, grilles, registers
- Dampers, VAV boxes
- Controls and thermostats
- Refrigerant piping
- Gas piping
- Roof curbs and supports
- Duct insulation
- Fire dampers
- Testing & balancing`,

    'Electrical': `
- Panelboards and switchgear
- Transformers
- Feeders and branch circuits
- Receptacles and devices
- Lighting fixtures
- Lighting controls
- Fire alarm devices
- Low voltage systems
- Grounding
- Conduit and wire
- Disconnect switches
- Motor connections`,

    'Plumbing': `
- Fixtures (toilets, sinks, etc.)
- Piping (water, waste, vent)
- Water heaters
- Pumps
- Valves
- Cleanouts
- Floor drains
- Roof drains
- Insulation
- Gas piping (if not mechanical)
- Medical gas (if applicable)`,

    // Add more trades...
  };

  return checklists[trade] || '- All items for this trade';
}
```

### 5.4 Pass 4: Cross-Document Correlation Prompt

```typescript
const PASS_4_PROMPT = (existingPackages: string) => `
You have the following work packages extracted from the design drawings:

${existingPackages}

Now, analyze these ADDITIONAL documents:
1. Project Specifications
2. Addenda
3. Bid Form / Schedule of Values
4. General Conditions

TASKS:

A. ADDITIONS - Find new requirements not in drawings:
   - Specification sections that add scope
   - Submittal requirements
   - Testing requirements
   - Warranty requirements

B. MODIFICATIONS - Changes to existing items:
   - Addenda that modify scope
   - Specification clarifications
   - Material substitutions (approved alternates)
   - Conflicts between documents

C. REFERENCES - Link items to document sources:
   - For each existing item, find specification section
   - Note any addendum modifications
   - Identify general conditions that affect scope

D. RISK FLAGS - Document conflicts/concerns:
   - Specification vs. drawing conflicts
   - Addendum superseding original requirements
   - Unclear scope boundaries
   - Items that may be "by others"

OUTPUT FORMAT:
{
  "additions": [
    {
      "work_package": string,
      "item": {...},
      "source_document": string,
      "source_section": string,
      "reasoning": string
    }
  ],
  "modifications": [
    {
      "original_item_ref": string,
      "modification_type": "scope_change" | "material_change" | "quantity_change" | "clarification",
      "changes": {...},
      "source_document": string,
      "source_section": string,
      "reasoning": string
    }
  ],
  "reference_links": [
    {
      "item_ref": string,
      "document": string,
      "section": string,
      "relationship": "spec_section" | "addendum" | "general_condition",
      "key_requirements": string[]
    }
  ],
  "risk_flags": [
    {
      "severity": "critical" | "warning" | "info",
      "category": string,
      "title": string,
      "description": string,
      "affected_items": string[],
      "source_references": string[]
    }
  ]
}
`;
```

### 5.5 Pass 5: Validation Prompt

```typescript
const PASS_5_PROMPT = (workPackages: string) => `
You are performing FINAL VALIDATION on these extracted work packages:

${workPackages}

Perform these quality checks:

1. QUANTITY REASONABLENESS
   - Do dimensions match quantities? (e.g., SF of roofing vs. building footprint)
   - Do equipment counts match between trades? (e.g., RTUs have matching electrical connections?)
   - Are ratios between trades reasonable? (e.g., typical plumbing fixture to electrical outlet ratio)

2. COMPLETENESS CHECK
   - Every equipment item has: power, controls, supports/curbs, connections
   - Demolition items have corresponding new installation (where applicable)
   - All systems are complete (supply + return, hot + cold, etc.)

3. SPECIFICATION COMPLIANCE
   - All critical spec requirements captured?
   - Warranty requirements noted?
   - Testing/balancing requirements included?

4. COORDINATION FLAGS
   - Items requiring coordination between trades
   - Items with potential conflicts
   - Unusual or custom items requiring attention

5. CONFIDENCE SCORING
   For each work package and line item, assign confidence:
   - HIGH (>80%): Clear source, complete data, verified against multiple sources
   - MEDIUM (50-80%): Source identified but some ambiguity
   - LOW (<50%): Inferred, unclear, or conflicting sources

OUTPUT: Final validated packages with confidence scores and observations.
`;
```

---

## 6. Model Orchestration

### 6.1 Orchestrator Implementation

```typescript
// lib/extraction/orchestrator.ts

import { GeminiClient } from './clients/gemini';
import { ClaudeClient } from './clients/claude';

export class ExtractionOrchestrator {
  private gemini: GeminiClient;
  private claude: ClaudeClient;
  private session: ExtractionSession;

  constructor(config: ExtractionConfig) {
    this.gemini = new GeminiClient();
    this.claude = new ClaudeClient();
  }

  async runExtraction(documents: Document[]): Promise<ExtractionSession> {
    this.session = await this.initializeSession(documents);

    try {
      // Pass 1: Initial extraction with Gemini
      await this.runPass1(documents);

      // Pass 2: Self-review
      await this.runPass2();

      // Pass 3: Trade-by-trade deep dive
      await this.runPass3();

      // Pass 4: Cross-document correlation
      await this.runPass4(documents);

      // Pass 5: Validation with Claude
      await this.runPass5();

      return this.session;
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  private async runPass1(documents: Document[]) {
    const primaryDoc = documents.find(d => d.type === 'design_drawings');
    if (!primaryDoc) throw new Error('No design drawings found');

    const result = await this.gemini.extract({
      document: primaryDoc,
      prompt: PASS_1_PROMPT,
    });

    this.session.workPackages = this.parseExtractionResult(result);
    this.emitProgress('pass_1_complete', { itemCount: this.session.workPackages.length });
  }

  private async runPass3() {
    const trades = this.getIdentifiedTrades();

    // Process trades in parallel (up to 3 concurrent)
    const batches = chunk(trades, 3);

    for (const batch of batches) {
      await Promise.all(batch.map(trade => this.deepDiveTrade(trade)));
    }
  }

  private async deepDiveTrade(trade: string) {
    const prompt = PASS_3_PROMPT(trade.name, trade.csiDivision);

    const result = await this.gemini.extract({
      document: this.primaryDocument,
      prompt,
    });

    // Merge with existing package
    this.mergeTradeResults(trade, result);
  }

  private async runPass5() {
    // Use Claude for final validation
    const validation = await this.claude.validate({
      workPackages: this.session.workPackages,
      prompt: PASS_5_PROMPT(JSON.stringify(this.session.workPackages)),
    });

    // Apply confidence scores
    this.applyConfidenceScores(validation);

    // Extract observations
    this.session.observations = validation.observations;

    // Determine if review required
    const criticalFlags = this.session.observations.filter(o => o.severity === 'critical');
    this.session.status = criticalFlags.length > 0 ? 'review_required' : 'completed';
  }
}
```

### 6.2 Gemini Client Implementation

```typescript
// lib/extraction/clients/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.5-pro-preview-05-06' // or latest
    });
  }

  async extract(options: {
    document: Document;
    prompt: string;
    additionalDocuments?: Document[];
  }): Promise<string> {
    const parts = [];

    // Add primary document
    if (options.document.type === 'pdf') {
      const pdfData = await this.loadPDF(options.document.url);
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfData,
        },
      });
    } else {
      const imageData = await this.loadImage(options.document.url);
      parts.push({
        inlineData: {
          mimeType: options.document.mimeType,
          data: imageData,
        },
      });
    }

    // Add additional documents if provided
    if (options.additionalDocuments) {
      for (const doc of options.additionalDocuments) {
        const data = await this.loadDocument(doc);
        parts.push({
          inlineData: {
            mimeType: doc.mimeType,
            data,
          },
        });
      }
    }

    // Add prompt
    parts.push({ text: options.prompt });

    const result = await this.model.generateContent(parts);
    return result.response.text();
  }

  private async loadPDF(url: string): Promise<string> {
    // Load PDF and convert to base64
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
```

---

## 7. UI/UX Considerations

### 7.1 Document Reference Display

```typescript
// Component: DocumentReferenceLink
// Displays a clickable reference that shows preview on hover/click

interface DocumentReferenceLinkProps {
  reference: DocumentReference;
  onNavigate: (ref: DocumentReference) => void;
}

// Features:
// 1. Hover shows thumbnail preview with bounding box highlighted
// 2. Click opens document viewer at that location
// 3. Different icons for different relationship types
// 4. Tooltip shows full reference details
```

### 7.2 Extraction Progress View

```
┌─────────────────────────────────────────────────────────────────┐
│ Extracting Work Packages                                    75% │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [✓] Pass 1: Initial Extraction          12 packages found     │
│  [✓] Pass 2: Self-Review                 +8 items added        │
│  [→] Pass 3: Trade Deep Dive             Mechanical (4/6)      │
│  [ ] Pass 4: Cross-Document              Waiting...            │
│  [ ] Pass 5: Validation                  Waiting...            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Live Feed:                                               │   │
│  │ • Found: RTU-6 (Gym) - 20 Ton Daikin                    │   │
│  │ • Found: Gas Piping - 2" Black Steel                    │   │
│  │ • Updated: EF-5 quantity from 1 to 2                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Cancel]                                           [Background]│
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Observations Panel

```
┌─────────────────────────────────────────────────────────────────┐
│ AI Observations                                    3 Critical   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🔴 CRITICAL                                                     │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Electrical Load Mismatch                                    ││
│ │                                                             ││
│ │ RTU-1 through RTU-5 exceed basis of design loads.          ││
│ │ Coordinate breaker/wire sizing with electrical contractor. ││
│ │                                                             ││
│ │ 📎 Addendum 1, Page 3    📎 Sheet E4.0                      ││
│ │                                                             ││
│ │ Affects: ELE-03, ELE-04, MEC-01 through MEC-05             ││
│ │                                                             ││
│ │ [Acknowledge]  [Add Note]  [Dismiss]                       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ 🟡 WARNING                                                      │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Unknown Utilities                                           ││
│ │ ...                                                         ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Line Item with References

```
┌─────────────────────────────────────────────────────────────────┐
│ MEC-01 | RTU-1 (Racquetball)                    Confidence: 94% │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Action: Replace                                                 │
│ Specifications: 4 Ton; Daikin 048; Gas/Electric; 1600 CFM      │
│                                                                 │
│ References:                                                     │
│ ┌──────────────────────────────┐ ┌────────────────────────────┐│
│ │ 📄 Sheet M0.1                │ │ 📋 Spec 23 81 26          ││
│ │ Equipment Schedule           │ │ Packaged Rooftop Units    ││
│ │ [Primary Definition]         │ │ [Specification]           ││
│ │ ┌────────────────────────┐  │ │                            ││
│ │ │ [Thumbnail Preview]    │  │ │ "Provide Daikin or        ││
│ │ │ [with bounding box]    │  │ │  approved equal..."       ││
│ │ └────────────────────────┘  │ └────────────────────────────┘│
│ └──────────────────────────────┘                               │
│                                                                 │
│ ⚠️ Modified by Addendum 1: Approved alternates: York, Rupp Air │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Phase 2: Learning & Optimization

### 8.1 Data Collection Strategy

```typescript
// Every prediction is tracked
interface PredictionTracker {
  // When model makes a prediction
  recordPrediction(
    entityType: 'work_package' | 'line_item' | 'observation',
    entityId: string,
    field: string,
    predictedValue: any,
    confidence: number,
    model: ModelIdentifier,
    context: ExtractionContext
  ): string; // returns prediction ID

  // When human corrects
  recordCorrection(
    predictionId: string,
    finalValue: any,
    userId: string
  ): void;

  // When model refines its own prediction
  recordRefinement(
    predictionId: string,
    newValue: any,
    newConfidence: number,
    refinementPass: number
  ): void;
}

// Context preserved for learning
interface ExtractionContext {
  projectType: string;           // Commercial, Healthcare, etc.
  projectSize: number;           // SF
  projectValue: number;          // Estimated value
  region: string;                // Geographic region
  documentTypes: string[];       // What documents were available
  modelVersion: string;          // Model version used
}
```

### 8.2 Confidence Calibration

```typescript
// Periodically recalibrate confidence scores
async function calibrateConfidence(): Promise<void> {
  const predictions = await db.predictionRecord.findMany({
    where: {
      finalValue: { not: null },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  // Group by model, entity type, field
  const groups = groupBy(predictions, p =>
    `${p.predictedBy}:${p.entityType}:${p.fieldName}`
  );

  for (const [key, preds] of Object.entries(groups)) {
    const [model, entityType, field] = key.split(':');

    // Calculate calibration bins
    const bins = calculateCalibrationBins(preds);

    await db.confidenceCalibration.upsert({
      where: { model_entityType_fieldName: { model, entityType, fieldName: field } },
      update: {
        calibrationData: JSON.stringify(bins),
        brierScore: calculateBrierScore(preds),
        calibrationError: calculateCalibrationError(bins),
        sampleCount: preds.length,
        lastUpdated: new Date(),
      },
      create: { /* ... */ },
    });
  }
}

// At runtime, adjust displayed confidence
function getDisplayConfidence(
  rawConfidence: number,
  model: ModelIdentifier,
  entityType: string,
  field: string
): number {
  const calibration = getCalibration(model, entityType, field);
  if (!calibration) return rawConfidence;

  // Find the calibration bin
  const bin = calibration.bins.find(b =>
    rawConfidence >= b.predictedConfidenceRange[0] &&
    rawConfidence < b.predictedConfidenceRange[1]
  );

  if (!bin) return rawConfidence;

  // Return the actual observed accuracy for this confidence range
  return bin.actualAccuracy;
}
```

### 8.3 Workflow Optimization

```typescript
// Track which workflows produce best results
interface WorkflowMetrics {
  workflowId: string;
  config: ExtractionConfig;

  // Quality metrics
  averageAccuracy: number;
  averageCompleteness: number;
  humanCorrectionRate: number;
  criticalMissRate: number;

  // Efficiency metrics
  averageDuration: number;
  tokenCost: number;

  // Sample size
  projectCount: number;
}

// A/B test different workflows
async function selectWorkflow(projectContext: ExtractionContext): Promise<ExtractionConfig> {
  // Get historical performance by project type
  const metrics = await db.workflowMetrics.findMany({
    where: {
      projectType: projectContext.projectType,
      projectCount: { gte: 10 }, // Minimum sample size
    },
    orderBy: { averageAccuracy: 'desc' },
  });

  if (metrics.length === 0) {
    return DEFAULT_WORKFLOW;
  }

  // Explore vs exploit (10% exploration)
  if (Math.random() < 0.1) {
    // Try a random workflow variant
    return generateWorkflowVariant(metrics[0].config);
  }

  // Use best performing workflow
  return metrics[0].config;
}
```

### 8.4 Model Performance Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Model Performance (Last 30 Days)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Overall Accuracy by Model:                                      │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Gemini 2.5 Pro  ████████████████████████░░░░  89.2%        ││
│ │ Claude Sonnet   ████████████████████████████░  94.1%       ││
│ │ Consensus       ██████████████████████████████ 97.3%       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Confidence Calibration:                                         │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Model says 90% confident → Actually correct 87% (well cal.) ││
│ │ Model says 70% confident → Actually correct 72% (well cal.) ││
│ │ Model says 50% confident → Actually correct 61% (under-conf)││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Common Correction Types:                                        │
│ 1. Quantity adjustments (34%)                                   │
│ 2. Missing items added (28%)                                    │
│ 3. CSI classification (18%)                                     │
│ 4. Reference corrections (12%)                                  │
│ 5. Other (8%)                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Core Infrastructure**
- [ ] Implement Gemini API client
- [ ] Update database schema (migrations)
- [ ] Create base extraction orchestrator
- [ ] Implement document upload enhancements (type detection)

**Week 2: Pass 1-3 Implementation**
- [ ] Implement Pass 1 extraction with Gemini
- [ ] Implement Pass 2 self-review
- [ ] Implement Pass 3 trade-by-trade extraction
- [ ] Create extraction session management

**Week 3: Pass 4-5 & Integration**
- [ ] Implement Pass 4 cross-document correlation
- [ ] Implement Pass 5 validation with Claude
- [ ] WebSocket real-time updates
- [ ] Basic progress UI

### Phase 2: Enrichment (Weeks 4-5)

**Week 4: Document References**
- [ ] Implement DocumentReference system
- [ ] PDF thumbnail generation for bounding boxes
- [ ] Text range highlighting for specs
- [ ] Reference linking API

**Week 5: Observations & Insights**
- [ ] Implement AI observations system
- [ ] Risk flag categorization
- [ ] Observations UI panel
- [ ] User response tracking

### Phase 3: UI/UX (Weeks 6-7)

**Week 6: Extraction UI**
- [ ] Extraction progress view
- [ ] Live feed of found items
- [ ] Work package review interface
- [ ] Reference preview on hover

**Week 7: Review & Correction UI**
- [ ] Human correction workflow
- [ ] Confidence score display
- [ ] Observation acknowledgment flow
- [ ] Document viewer integration

### Phase 4: Learning System (Weeks 8-10)

**Week 8: Data Collection**
- [ ] Prediction tracking implementation
- [ ] Correction recording
- [ ] Context preservation

**Week 9: Calibration**
- [ ] Confidence calibration jobs
- [ ] Display confidence adjustment
- [ ] Calibration dashboard

**Week 10: Optimization**
- [ ] Workflow metrics collection
- [ ] A/B testing framework
- [ ] Model performance dashboard

---

## Appendix A: Environment Variables

```env
# Existing
ANTHROPIC_API_KEY=sk-ant-...

# New for Gemini
GOOGLE_AI_API_KEY=AIza...

# Optional: For future models
OPENAI_API_KEY=sk-...
```

## Appendix B: Cost Estimation

| Model | Input Tokens (per 1M) | Output Tokens (per 1M) | Est. per Project |
|-------|----------------------|------------------------|------------------|
| Gemini 2.5 Pro | $1.25 | $10.00 | ~$2-5 |
| Claude Sonnet 4.5 | $3.00 | $15.00 | ~$1-3 |
| **Combined** | - | - | **~$3-8** |

## Appendix C: Related Documentation

- [CHAT_SYSTEM.md](./CHAT_SYSTEM.md) - Existing chat implementation
- [VISUAL_FEATURES.md](./VISUAL_FEATURES.md) - Bounding box display
- [COMPONENTS_REFERENCE.md](./COMPONENTS_REFERENCE.md) - Component APIs
