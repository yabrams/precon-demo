# Code Review Follow-up: Latest Changes Analysis

**Reviewer**: Principal Developer  
**Date**: 2025-01-XX  
**Review Type**: Follow-up review after initial feedback

---

## Executive Summary

The developer has **updated the prompts** to request bounding boxes and AI observations, but has **not implemented the parsing and persistence logic** to actually use this data. The code still has the same critical gaps as before, with additional flow issues introduced by the prompt changes that aren't being handled.

**Status**: ⚠️ **Incomplete Implementation** - Prompts updated but no code to process the responses.

---

## Changes Identified

### ✅ What Was Changed

1. **Gemini Prompts Enhanced** (`lib/extraction/clients/gemini.ts`)
   - Pass 1 prompt now requests `bounding_box` coordinates
   - Pass 1 prompt now requests `ai_observations` array
   - Pass 2 prompt now requests `ai_observations` in review response
   - Prompts specify bounding box format: `[y_min, x_min, y_max, x_max]`

2. **Prompt Instructions Improved**
   - Added emphasis on "FULL TRACEABILITY"
   - Added instructions for confidence scores
   - Added instructions for AI observations

### ❌ What Was NOT Changed (Critical Gaps)

1. **Type Definitions Not Updated**
   - `GeminiExtractionResponse` doesn't include `ai_observations` field
   - `GeminiRawLineItem.source_reference` doesn't include `bounding_box` field
   - `GeminiReviewResponse` doesn't include `ai_observations` field

2. **No Parsing Logic**
   - No code to extract `ai_observations` from Pass 1 responses
   - No code to parse `bounding_box` from `source_reference`
   - No code to convert bounding box format `[y_min, x_min, y_max, x_max]` to `BoundingBox` type `{x, y, width, height}`

3. **No Reference Creation**
   - `convertRawLineItem()` still returns `references: []`
   - No method to create `DocumentReference` objects
   - No method to persist `DocumentReferenceRecord` to database

4. **No Observation Extraction**
   - Pass 1 doesn't extract `ai_observations` from Gemini response
   - Pass 2 doesn't extract `ai_observations` from review response
   - Only basic observations from `generateBasicObservations()` are used

---

## Critical Flow Issues

### 🔴 Issue 1: Type Mismatch - AI Observations Not in Response Type

**Location**: `lib/extraction/types.ts:427-432`

```typescript
export interface GeminiExtractionResponse {
  project_name?: string;
  work_packages: GeminiRawWorkPackage[];
  incomplete_areas?: string[];
  extraction_notes?: string;
  // ❌ MISSING: ai_observations field
}
```

**Problem**: 
- Prompt requests `ai_observations` array (line 467-481 in gemini.ts)
- Type definition doesn't include this field
- Code will fail at runtime if Gemini returns observations

**Impact**: TypeScript won't catch missing field, runtime errors likely

**Fix Required**:
```typescript
export interface GeminiExtractionResponse {
  project_name?: string;
  work_packages: GeminiRawWorkPackage[];
  incomplete_areas?: string[];
  extraction_notes?: string;
  ai_observations?: Array<{
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
  }>;
}
```

---

### 🔴 Issue 2: Bounding Box Format Mismatch

**Location**: `lib/extraction/clients/gemini.ts:458`

**Prompt Requests**:
```typescript
"bounding_box": [y_min, x_min, y_max, x_max]  // Array of 4 numbers
```

**Type Definition**:
```typescript
interface BoundingBox {
  x: number;      // Normalized 0-1, left edge
  y: number;      // Normalized 0-1, top edge
  width: number;  // Normalized 0-1
  height: number; // Normalized 0-1
}
```

**Problem**: 
- Prompt requests `[y_min, x_min, y_max, x_max]` format
- Type expects `{x, y, width, height}` format
- No conversion function exists
- Also: Prompt says "normalized coordinates [0-1000]" but type says "[0-1]" - inconsistent!

**Impact**: Cannot parse bounding boxes even if Gemini returns them

**Fix Required**:
```typescript
private convertBoundingBox(
  rawBox: [number, number, number, number], // [y_min, x_min, y_max, x_max]
  pageWidth: number = 1000,
  pageHeight: number = 1000
): BoundingBox {
  const [yMin, xMin, yMax, xMax] = rawBox;
  
  // Convert to normalized 0-1 coordinates
  return {
    x: xMin / pageWidth,
    y: yMin / pageHeight,
    width: (xMax - xMin) / pageWidth,
    height: (yMax - yMin) / pageHeight,
  };
}
```

---

### 🔴 Issue 3: Source Reference Type Missing Bounding Box

**Location**: `lib/extraction/types.ts:419-423`

```typescript
export interface GeminiRawLineItem {
  // ...
  source_reference?: {
    sheet?: string;
    location?: string;
    page?: number;
    // ❌ MISSING: bounding_box field
    // ❌ MISSING: text_excerpt field
  };
  flags?: string[];
}
```

**Problem**: 
- Prompt requests `bounding_box` in `source_reference`
- Type doesn't include it
- Cannot parse even if Gemini returns it

**Fix Required**:
```typescript
source_reference?: {
  sheet?: string;
  location?: string;
  page?: number;
  bounding_box?: [number, number, number, number]; // [y_min, x_min, y_max, x_max]
  text_excerpt?: string;
};
```

---

### 🔴 Issue 4: No Code to Extract AI Observations from Pass 1

**Location**: `lib/extraction/orchestrator.ts:154-156`

```typescript
// Convert raw response to typed work packages
const workPackages = this.convertRawPackages(result.response, 1);
this.session.workPackages = workPackages;
// ❌ MISSING: Extract ai_observations from result.response
```

**Problem**: 
- Prompt requests `ai_observations` in Pass 1
- Code doesn't extract them
- Observations are lost

**Fix Required**:
```typescript
// Convert raw response to typed work packages
const workPackages = this.convertRawPackages(result.response, 1);
this.session.workPackages = workPackages;

// Extract AI observations from Pass 1
if (result.response.ai_observations) {
  const observations = this.convertRawObservations(
    result.response.ai_observations,
    1
  );
  this.session.observations.push(...observations);
}
```

---

### 🔴 Issue 5: No Code to Create Document References

**Location**: `lib/extraction/orchestrator.ts:571-592`

```typescript
private convertRawLineItem(
  rawItem: GeminiRawLineItem,
  order: number,
  pass: number
): ExtractedLineItem {
  return {
    // ...
    references: [], // ❌ Always empty - should create DocumentReference objects
    // ...
  };
}
```

**Problem**: 
- `source_reference` is parsed but not used
- No `DocumentReference` objects created
- References array always empty

**Fix Required**:
```typescript
private async convertRawLineItem(
  rawItem: GeminiRawLineItem,
  order: number,
  pass: number,
  documentId: string,
  documentName: string
): Promise<ExtractedLineItem> {
  const references: DocumentReference[] = [];
  
  // Create document reference if source_reference exists
  if (rawItem.source_reference) {
    const ref = await this.createDocumentReference(
      rawItem.source_reference,
      documentId,
      documentName,
      pass
    );
    references.push(ref);
  }
  
  return {
    // ...
    references,
    primaryReferenceId: references[0]?.id,
    // ...
  };
}
```

---

### 🔴 Issue 6: No Method to Create DocumentReference Objects

**Location**: `lib/extraction/orchestrator.ts` - **MISSING METHOD**

**Problem**: 
- No method exists to create `DocumentReference` from `source_reference`
- No method to convert bounding box format
- No method to determine relationship type

**Fix Required**:
```typescript
private async createDocumentReference(
  sourceRef: {
    sheet?: string;
    location?: string;
    page?: number;
    bounding_box?: [number, number, number, number];
    text_excerpt?: string;
  },
  documentId: string,
  documentName: string,
  pass: number
): Promise<DocumentReference> {
  const refId = this.generateId();
  
  // Determine relationship type based on location
  let relationshipType: DocumentRelationshipType = 'defined_at';
  if (sourceRef.location?.toLowerCase().includes('schedule')) {
    relationshipType = 'schedule_in';
  } else if (sourceRef.location?.toLowerCase().includes('detail')) {
    relationshipType = 'detail_at';
  }
  
  // Convert bounding box if provided
  let boundingBox: BoundingBox | undefined;
  if (sourceRef.bounding_box) {
    boundingBox = this.convertBoundingBox(sourceRef.bounding_box);
  }
  
  // Create document location
  const location: DocumentLocation = {
    documentId,
    documentName,
    documentType: 'design_drawings', // Should be determined from document
    pageNumber: sourceRef.page || 1,
    sheetNumber: sourceRef.sheet,
    boundingBox,
    extractedText: sourceRef.text_excerpt,
  };
  
  // Create reference
  const reference: DocumentReference = {
    id: refId,
    location,
    relationshipType,
    confidence: 0.8, // Should be calculated
    extractedBy: 'gemini-2.5-pro',
    reasoning: `Extracted from ${sourceRef.location || 'document'}`,
    displayLabel: sourceRef.sheet 
      ? `Sheet ${sourceRef.sheet}${sourceRef.location ? ` - ${sourceRef.location}` : ''}`
      : documentName,
    previewSnippet: sourceRef.text_excerpt,
  };
  
  // Persist to database
  await this.persistDocumentReference(reference);
  
  return reference;
}
```

---

### 🔴 Issue 7: No Persistence of Document References

**Location**: `lib/extraction/orchestrator.ts:734-860` - **MISSING CODE**

**Problem**: 
- `persistSession()` doesn't create `DocumentReferenceRecord` entries
- References are never saved to database
- Cannot retrieve references later

**Fix Required**:
```typescript
private async persistDocumentReference(
  ref: DocumentReference
): Promise<void> {
  try {
    await prisma.documentReferenceRecord.create({
      data: {
        id: ref.id,
        sessionId: this.session.id,
        documentId: ref.location.documentId,
        documentName: ref.location.documentName,
        documentType: ref.location.documentType,
        pageNumber: ref.location.pageNumber,
        sheetNumber: ref.location.sheetNumber,
        boundingBox: ref.location.boundingBox 
          ? JSON.stringify(ref.location.boundingBox)
          : null,
        textRange: ref.location.textRange
          ? JSON.stringify(ref.location.textRange)
          : null,
        extractedText: ref.location.extractedText,
        relationshipType: ref.relationshipType,
        displayLabel: ref.displayLabel,
        previewSnippet: ref.previewSnippet,
        extractedBy: ref.extractedBy,
        confidence: ref.confidence,
        reasoning: ref.reasoning,
      },
    });
  } catch (error) {
    console.error('Failed to persist document reference:', error);
  }
}
```

---

### 🔴 Issue 8: Reference IDs Not Linked to Line Items

**Location**: `lib/extraction/orchestrator.ts:800-827`

```typescript
await prisma.extractedLineItemRecord.upsert({
  // ...
  // ❌ MISSING: referenceIds field
  // ❌ MISSING: primaryReferenceId field
});
```

**Problem**: 
- Line items have `referenceIds` and `primaryReferenceId` fields in schema
- But they're never populated
- Cannot query which references belong to which line item

**Fix Required**:
```typescript
await prisma.extractedLineItemRecord.upsert({
  where: { id: item.id },
  create: {
    // ... existing fields ...
    referenceIds: item.references.length > 0
      ? JSON.stringify(item.references.map(r => r.id))
      : null,
    primaryReferenceId: item.primaryReferenceId || null,
  },
  update: {
    // ... existing fields ...
    referenceIds: item.references.length > 0
      ? JSON.stringify(item.references.map(r => r.id))
      : null,
    primaryReferenceId: item.primaryReferenceId || null,
  },
});
```

---

### 🔴 Issue 9: API Route Returns Empty References

**Location**: `app/api/extraction/[sessionId]/route.ts:96, 138`

```typescript
references: [], // ❌ Always empty
```

**Problem**: 
- Even if references were created, API doesn't load them from database
- Returns empty arrays to frontend
- UI cannot display document links

**Fix Required**:
```typescript
// Load document references for line items
const lineItemIds = pkg.lineItems.map(item => item.id);
const references = await prisma.documentReferenceRecord.findMany({
  where: {
    sessionId: session.id,
    // Need to link via referenceIds - requires schema change or join table
  },
});

// Map references to line items
const referencesByItemId = new Map<string, DocumentReference[]>();
// ... populate map ...

lineItems: pkg.lineItems.map(item => ({
  // ...
  references: referencesByItemId.get(item.id) || [],
  // ...
}))
```

**Note**: This requires either:
- A join table linking `DocumentReferenceRecord` to `ExtractedLineItemRecord`
- OR loading references by parsing `referenceIds` JSON field

---

### 🟡 Issue 10: Pass 2 Review Response Missing AI Observations

**Location**: `lib/extraction/types.ts:434-447`

```typescript
export interface GeminiReviewResponse {
  additions: GeminiRawLineItem[];
  modifications: { /* ... */ }[];
  gaps_identified: string[];
  confidence_adjustments: { /* ... */ }[];
  // ❌ MISSING: ai_observations field
}
```

**Problem**: 
- Pass 2 prompt requests `ai_observations`
- Type doesn't include it
- Code doesn't extract them

**Fix Required**: Add `ai_observations` field to `GeminiReviewResponse`

---

### 🟡 Issue 11: No Code to Extract Observations from Pass 2

**Location**: `lib/extraction/orchestrator.ts:258-263`

```typescript
const result = await this.gemini.reviewExtraction(
  this.documents.filter(d => d.type === 'design_drawings'),
  currentExtraction
);
// ❌ MISSING: Extract ai_observations from result.response
```

**Fix Required**: Extract and convert observations from Pass 2 response

---

### 🟡 Issue 12: Confidence Score Structure Mismatch

**Location**: `lib/extraction/clients/gemini.ts:441-444`

**Prompt Requests**:
```typescript
"confidence": {
  "overall": 0.85,
  "reasoning": "Clear equipment schedule with quantities"
}
```

**But Code Expects**:
```typescript
// In convertRawPackage() - no confidence field in GeminiRawWorkPackage
// Confidence is created with createExtractionMetadata(pass, 0.7) - hardcoded!
```

**Problem**: 
- Prompt requests confidence per package
- Code ignores it and uses hardcoded 0.7
- Package-level confidence from Gemini is lost

---

## Data Flow Analysis

### Current Flow (Broken)

```
1. Gemini API Call
   ↓
2. Parse JSON Response
   ↓
3. convertRawPackages() → convertRawPackage() → convertRawLineItem()
   ❌ source_reference ignored
   ❌ ai_observations ignored
   ❌ bounding_box ignored
   ↓
4. persistSession()
   ❌ No DocumentReferenceRecord created
   ❌ referenceIds not set
   ↓
5. API Returns Results
   ❌ references: [] (always empty)
```

### Expected Flow (Per Spec)

```
1. Gemini API Call
   ↓
2. Parse JSON Response
   ↓
3. Extract work_packages AND ai_observations
   ↓
4. For each line item:
   - Parse source_reference
   - Convert bounding_box format
   - Create DocumentReference object
   - Persist DocumentReferenceRecord
   - Link to line item via referenceIds
   ↓
5. For each observation:
   - Parse source_reference
   - Create DocumentReference
   - Link to observation
   ↓
6. persistSession()
   - Save all DocumentReferenceRecord entries
   - Set referenceIds on line items
   ↓
7. API Returns Results
   - Load references from database
   - Populate references arrays
```

---

## Code Quality Issues

### 1. **Type Safety Violations**

```typescript
// orchestrator.ts:272
const targetPackage = this.session.workPackages.find(
  p => p.packageId === (addition as any).work_package  // ❌ Using 'as any'
);
```

**Issue**: Type assertion bypasses type checking  
**Fix**: Define proper type for review response additions

### 2. **Missing Async/Await - Critical Flow Issue**

**Location**: `lib/extraction/orchestrator.ts:535-592`

**Current Code**:
```typescript
private convertRawPackages(
  response: GeminiExtractionResponse,
  pass: number
): ExtractedWorkPackage[] {
  return response.work_packages.map(rawPkg =>
    this.convertRawPackage(rawPkg, pass)  // ❌ Synchronous
  );
}

private convertRawPackage(
  rawPkg: GeminiRawWorkPackage,
  pass: number
): ExtractedWorkPackage {
  const lineItems = rawPkg.line_items.map((item, idx) =>
    this.convertRawLineItem(item, idx, pass)  // ❌ Synchronous
  );
  // ...
}

private convertRawLineItem(
  rawItem: GeminiRawLineItem,
  order: number,
  pass: number
): ExtractedLineItem {
  // ❌ Would need to call async createDocumentReference()
  // ❌ But method is synchronous
}
```

**Problem**: 
- To create document references, need to call async `createDocumentReference()`
- But `convertRawLineItem()` is synchronous
- Called from `convertRawPackage()` which is also synchronous
- Called from `convertRawPackages()` which is also synchronous
- Called from `runPass1()` which is async, but uses `.map()` which doesn't await

**Impact**: Cannot implement reference creation without major refactoring

**Fix Required**:
```typescript
// All methods must become async
private async convertRawPackages(
  response: GeminiExtractionResponse,
  pass: number
): Promise<ExtractedWorkPackage[]> {
  return Promise.all(
    response.work_packages.map(rawPkg =>
      this.convertRawPackage(rawPkg, pass)
    )
  );
}

private async convertRawPackage(
  rawPkg: GeminiRawWorkPackage,
  pass: number
): Promise<ExtractedWorkPackage> {
  const lineItems = await Promise.all(
    rawPkg.line_items.map((item, idx) =>
      this.convertRawLineItem(item, idx, pass, /* document info */)
    )
  );
  // ...
}

private async convertRawLineItem(
  rawItem: GeminiRawLineItem,
  order: number,
  pass: number,
  documentId: string,
  documentName: string
): Promise<ExtractedLineItem> {
  const references: DocumentReference[] = [];
  
  if (rawItem.source_reference) {
    const ref = await this.createDocumentReference(
      rawItem.source_reference,
      documentId,
      documentName,
      pass
    );
    references.push(ref);
  }
  
  return {
    // ...
    references,
    // ...
  };
}
```

**Also Update Callers**:
```typescript
// runPass1()
const workPackages = await this.convertRawPackages(result.response, 1);

// runPass2()
const newItem = await this.convertRawLineItem(
  addition as GeminiRawLineItem,
  targetPackage.lineItems.length,
  2,
  /* document info */
);
```

### 3. **Error Handling**

```typescript
// orchestrator.ts:856-859
} catch (error) {
  console.error('Failed to persist session:', error);
  // Don't throw - we don't want to fail extraction due to persistence issues
}
```

**Issue**: Silently swallows errors  
**Problem**: If references fail to persist, no indication to user  
**Fix**: At least log which references failed, consider partial success handling

### 4. **Hardcoded Values**

```typescript
// orchestrator.ts:565
extraction: this.createExtractionMetadata(pass, 0.7), // ❌ Hardcoded confidence
```

**Issue**: Ignores confidence from Gemini response  
**Fix**: Parse confidence from raw response

---

## Test Coverage Gaps

### Missing Tests

1. **No tests for bounding box conversion**
   - No test for `[y_min, x_min, y_max, x_max]` → `{x, y, width, height}` conversion
   - No test for coordinate normalization

2. **No tests for document reference creation**
   - No test for `createDocumentReference()` method (doesn't exist)
   - No test for reference persistence

3. **No tests for AI observation extraction**
   - No test for parsing `ai_observations` from Pass 1
   - No test for parsing `ai_observations` from Pass 2

4. **No tests for reference linking**
   - No test for `referenceIds` population
   - No test for `primaryReferenceId` setting

5. **No integration tests for full flow**
   - No test that verifies references are created end-to-end
   - No test that verifies references are returned in API

---

## Recommendations

### Immediate Fixes (Critical - Block Phase 1)

1. **Update Type Definitions** (1 hour)
   - Add `ai_observations` to `GeminiExtractionResponse`
   - Add `bounding_box` to `GeminiRawLineItem.source_reference`
   - Add `ai_observations` to `GeminiReviewResponse`

2. **Implement Bounding Box Conversion** (2 hours)
   - Create `convertBoundingBox()` method
   - Handle coordinate normalization
   - Add validation

3. **Implement Document Reference Creation** (4 hours)
   - Create `createDocumentReference()` method
   - Create `persistDocumentReference()` method
   - Update `convertRawLineItem()` to be async and create references
   - Update all callers of `convertRawLineItem()`

4. **Implement AI Observation Extraction** (2 hours)
   - Extract observations from Pass 1 response
   - Extract observations from Pass 2 response
   - Convert to `AIObservation` type
   - Link references to observations

5. **Update Persistence Logic** (2 hours)
   - Persist `DocumentReferenceRecord` entries
   - Set `referenceIds` on line items
   - Set `primaryReferenceId` on line items

6. **Update API Route** (2 hours)
   - Load references from database
   - Populate `references` arrays in response
   - Handle reference loading efficiently

### Code Quality Improvements

1. **Remove Type Assertions**
   - Define proper types for review responses
   - Remove all `as any` usages

2. **Add Error Handling**
   - Better error messages
   - Partial success handling
   - Retry logic for reference creation

3. **Add Validation**
   - Validate bounding box coordinates
   - Validate page numbers
   - Validate sheet numbers

### Testing Requirements

1. **Unit Tests**
   - Bounding box conversion
   - Document reference creation
   - AI observation parsing

2. **Integration Tests**
   - Full flow with reference creation
   - Reference persistence
   - API response with references

3. **E2E Tests**
   - Verify references appear in UI
   - Verify bounding boxes are correct
   - Verify text ranges work

---

## Conclusion

The developer has **updated the prompts** to request the required data (bounding boxes, AI observations), but has **not implemented any of the parsing, conversion, or persistence logic** needed to actually use this data.

**Status**: ⚠️ **Implementation Incomplete** - Prompts updated but no functional code changes.

**Critical Issues**:
1. Type definitions don't match prompts
2. No parsing logic for bounding boxes
3. No parsing logic for AI observations
4. No document reference creation
5. No document reference persistence
6. API returns empty references

**Estimated Effort to Complete**: 12-15 hours of focused development

**Recommendation**: **Do not merge** until all critical fixes are implemented and tested.

---

## Additional Flow Issues Found

### 🟡 Issue 13: Package Confidence Not Parsed

**Location**: `lib/extraction/types.ts:401-409` and `lib/extraction/orchestrator.ts:565`

**Problem**:
- Prompt requests `confidence: { overall, reasoning }` per package (line 441-444 in gemini.ts)
- `GeminiRawWorkPackage` type doesn't include `confidence` field
- Code hardcodes confidence to 0.7 instead of using Gemini's value

**Fix**: Add `confidence` field to `GeminiRawWorkPackage` and parse it

### 🟡 Issue 14: Line Item Confidence Not Parsed

**Location**: `lib/extraction/types.ts:411-425` and `lib/extraction/orchestrator.ts:587-590`

**Problem**:
- Prompt requests `confidence: 0.9` per line item (line 461 in gemini.ts)
- `GeminiRawLineItem` type doesn't include `confidence` field
- Code calculates confidence from flags only: `rawItem.flags?.includes('NEEDS_REVIEW') ? 0.5 : 0.7`

**Fix**: Add `confidence` field to `GeminiRawLineItem` and use it

### 🟡 Issue 15: Document Type Not Passed to Reference Creation

**Location**: `lib/extraction/orchestrator.ts:571-592`

**Problem**:
- `convertRawLineItem()` doesn't receive document information
- Cannot determine `documentType` for `DocumentLocation`
- Hardcoded to 'design_drawings' in my suggested fix

**Fix**: Pass document information through the conversion chain

### 🟡 Issue 16: Multiple Documents Not Handled

**Location**: `lib/extraction/orchestrator.ts:148-150`

**Problem**:
- `runPass1()` filters to only `design_drawings`
- But `convertRawLineItem()` doesn't know which document the reference came from
- If multiple design drawings, cannot determine which one

**Fix**: Track which document each item came from, or pass document context

---

## Summary of All Issues

### Critical (Blocking Phase 1)
1. ❌ Type definitions don't match prompts (ai_observations, bounding_box)
2. ❌ No bounding box conversion function
3. ❌ No document reference creation method
4. ❌ No document reference persistence
5. ❌ No AI observation extraction from responses
6. ❌ API returns empty references
7. ❌ Async/await flow broken (sync methods need to be async)

### High Priority
8. ⚠️ Reference IDs not linked to line items
9. ⚠️ Package confidence not parsed
10. ⚠️ Line item confidence not parsed
11. ⚠️ Pass 2 observations not extracted

### Medium Priority
12. ⚠️ Document type not passed through
13. ⚠️ Multiple documents not handled
14. ⚠️ Error handling could be better
15. ⚠️ Type assertions (`as any`) should be removed

---

## Testing Checklist

Before Phase 1 sign-off, verify:

- [ ] Type definitions match prompt responses
- [ ] Bounding boxes are parsed and converted correctly
- [ ] Document references are created for each line item with source_reference
- [ ] Document references are persisted to database
- [ ] Reference IDs are set on line items
- [ ] API returns populated references arrays
- [ ] AI observations from Pass 1 are extracted
- [ ] AI observations from Pass 2 are extracted
- [ ] Observations have document references
- [ ] Confidence scores are parsed from responses
- [ ] All async/await flows work correctly
- [ ] Tests cover reference creation and persistence
- [ ] Tests verify bounding box conversion
- [ ] Tests verify observation extraction

---

## Priority Fix Order

1. **Fix type definitions** (blocks everything else)
2. **Implement bounding box conversion** (needed for references)
3. **Implement document reference creation** (core feature)
4. **Implement AI observation extraction** (spec requirement)
5. **Update persistence** (needed for data to be saved)
6. **Update API route** (needed for UI to work)
7. **Add tests** (needed for confidence)

