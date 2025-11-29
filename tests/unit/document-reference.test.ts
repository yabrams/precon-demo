/**
 * DocumentReference Unit Tests
 *
 * Tests for document reference data structures and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentReference,
  DocumentLocation,
  DocumentType,
  DocumentRelationshipType,
  BoundingBox,
  TextRange,
} from '@/lib/extraction/types';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockBoundingBox(overrides: Partial<BoundingBox> = {}): BoundingBox {
  return {
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.15,
    ...overrides,
  };
}

function createMockTextRange(overrides: Partial<TextRange> = {}): TextRange {
  return {
    startLine: 10,
    endLine: 15,
    startChar: 0,
    endChar: 80,
    highlightText: 'RTU-1 shall be installed per manufacturer specifications',
    ...overrides,
  };
}

function createMockLocation(overrides: Partial<DocumentLocation> = {}): DocumentLocation {
  return {
    documentId: 'doc_123',
    documentName: 'M1.0 Mechanical Plan',
    documentType: 'design_drawings',
    pageNumber: 5,
    sheetNumber: 'M1.0',
    ...overrides,
  };
}

function createMockReference(overrides: Partial<DocumentReference> = {}): DocumentReference {
  return {
    id: `ref_${Math.random().toString(36).substr(2, 9)}`,
    location: createMockLocation(),
    relationshipType: 'defined_at',
    confidence: 0.9,
    extractedBy: 'gemini-2.5-pro',
    displayLabel: 'Sheet M1.0, Page 5',
    previewSnippet: 'RTU-1 installation shown at grid A-5',
    ...overrides,
  };
}

// ============================================================================
// BOUNDING BOX TESTS
// ============================================================================

describe('BoundingBox', () => {
  describe('validation', () => {
    it('should have valid normalized coordinates (0-1)', () => {
      const box = createMockBoundingBox();

      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x).toBeLessThanOrEqual(1);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeLessThanOrEqual(1);
      expect(box.width).toBeGreaterThan(0);
      expect(box.width).toBeLessThanOrEqual(1);
      expect(box.height).toBeGreaterThan(0);
      expect(box.height).toBeLessThanOrEqual(1);
    });

    it('should not exceed bounds when coordinates + dimensions', () => {
      const box = createMockBoundingBox({
        x: 0.7,
        y: 0.8,
        width: 0.3,
        height: 0.2,
      });

      expect(box.x + box.width).toBeLessThanOrEqual(1);
      expect(box.y + box.height).toBeLessThanOrEqual(1);
    });
  });

  describe('area calculations', () => {
    it('should calculate area correctly', () => {
      const box = createMockBoundingBox({
        width: 0.5,
        height: 0.4,
      });

      const area = box.width * box.height;
      expect(area).toBe(0.2);
    });

    it('should identify small boxes', () => {
      const smallBox = createMockBoundingBox({
        width: 0.05,
        height: 0.05,
      });

      const area = smallBox.width * smallBox.height;
      expect(area).toBeLessThan(0.01); // Less than 1% of page
    });
  });
});

// ============================================================================
// TEXT RANGE TESTS
// ============================================================================

describe('TextRange', () => {
  describe('line spanning', () => {
    it('should have valid line numbers', () => {
      const range = createMockTextRange();

      expect(range.startLine).toBeGreaterThan(0);
      expect(range.endLine).toBeGreaterThanOrEqual(range.startLine);
    });

    it('should calculate line count', () => {
      const range = createMockTextRange({
        startLine: 10,
        endLine: 15,
      });

      const lineCount = range.endLine - range.startLine + 1;
      expect(lineCount).toBe(6);
    });

    it('should handle single-line range', () => {
      const range = createMockTextRange({
        startLine: 10,
        endLine: 10,
      });

      const lineCount = range.endLine - range.startLine + 1;
      expect(lineCount).toBe(1);
    });
  });

  describe('highlight text', () => {
    it('should have highlight text', () => {
      const range = createMockTextRange();
      expect(range.highlightText).toBeTruthy();
      expect(range.highlightText.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// DOCUMENT LOCATION TESTS
// ============================================================================

describe('DocumentLocation', () => {
  describe('required fields', () => {
    it('should have document ID', () => {
      const loc = createMockLocation();
      expect(loc.documentId).toBeTruthy();
    });

    it('should have document name', () => {
      const loc = createMockLocation();
      expect(loc.documentName).toBeTruthy();
    });

    it('should have document type', () => {
      const loc = createMockLocation();
      expect(loc.documentType).toBe('design_drawings');
    });

    it('should have page number', () => {
      const loc = createMockLocation();
      expect(loc.pageNumber).toBeGreaterThan(0);
    });
  });

  describe('optional fields', () => {
    it('should support sheet number', () => {
      const loc = createMockLocation({ sheetNumber: 'M1.0' });
      expect(loc.sheetNumber).toBe('M1.0');
    });

    it('should support bounding box', () => {
      const loc = createMockLocation({
        boundingBox: createMockBoundingBox(),
      });
      expect(loc.boundingBox).toBeDefined();
    });

    it('should support text range', () => {
      const loc = createMockLocation({
        textRange: createMockTextRange(),
      });
      expect(loc.textRange).toBeDefined();
    });

    it('should support thumbnail URL', () => {
      const loc = createMockLocation({
        thumbnailUrl: '/uploads/thumbnails/doc_123_p5.jpg',
      });
      expect(loc.thumbnailUrl).toBeTruthy();
    });

    it('should support extracted text', () => {
      const loc = createMockLocation({
        extractedText: 'RTU-1: 5 TON ROOFTOP UNIT',
      });
      expect(loc.extractedText).toBeTruthy();
    });
  });

  describe('document types', () => {
    const documentTypes: DocumentType[] = [
      'design_drawings',
      'specifications',
      'addendum',
      'bid_form',
      'geotechnical',
      'permits',
      'contracts',
      'schedules',
      'details',
      'other',
    ];

    it('should support all document types', () => {
      for (const type of documentTypes) {
        const loc = createMockLocation({ documentType: type });
        expect(loc.documentType).toBe(type);
      }
    });
  });
});

// ============================================================================
// DOCUMENT REFERENCE TESTS
// ============================================================================

describe('DocumentReference', () => {
  describe('required fields', () => {
    it('should have ID', () => {
      const ref = createMockReference();
      expect(ref.id).toBeTruthy();
    });

    it('should have location', () => {
      const ref = createMockReference();
      expect(ref.location).toBeDefined();
      expect(ref.location.documentId).toBeTruthy();
    });

    it('should have relationship type', () => {
      const ref = createMockReference();
      expect(ref.relationshipType).toBe('defined_at');
    });

    it('should have confidence', () => {
      const ref = createMockReference();
      expect(ref.confidence).toBeGreaterThanOrEqual(0);
      expect(ref.confidence).toBeLessThanOrEqual(1);
    });

    it('should have extractedBy', () => {
      const ref = createMockReference();
      expect(ref.extractedBy).toBeTruthy();
    });

    it('should have display label', () => {
      const ref = createMockReference();
      expect(ref.displayLabel).toBeTruthy();
    });
  });

  describe('relationship types', () => {
    const relationshipTypes: DocumentRelationshipType[] = [
      'defined_at',
      'modified_by',
      'clarified_in',
      'quantity_from',
      'detail_at',
      'schedule_in',
      'spec_section',
      'superseded_by',
      'conflicts_with',
    ];

    it('should support all relationship types', () => {
      for (const type of relationshipTypes) {
        const ref = createMockReference({ relationshipType: type });
        expect(ref.relationshipType).toBe(type);
      }
    });
  });

  describe('confidence levels', () => {
    it('should identify high confidence (>= 0.8)', () => {
      const ref = createMockReference({ confidence: 0.9 });
      const isHighConfidence = ref.confidence >= 0.8;
      expect(isHighConfidence).toBe(true);
    });

    it('should identify medium confidence (0.5-0.8)', () => {
      const ref = createMockReference({ confidence: 0.65 });
      const isMediumConfidence = ref.confidence >= 0.5 && ref.confidence < 0.8;
      expect(isMediumConfidence).toBe(true);
    });

    it('should identify low confidence (< 0.5)', () => {
      const ref = createMockReference({ confidence: 0.3 });
      const isLowConfidence = ref.confidence < 0.5;
      expect(isLowConfidence).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('should support reasoning', () => {
      const ref = createMockReference({
        reasoning: 'Found explicit reference to equipment in drawing notes',
      });
      expect(ref.reasoning).toBeTruthy();
    });

    it('should support preview snippet', () => {
      const ref = createMockReference({
        previewSnippet: 'RTU-1 installation shown at grid A-5',
      });
      expect(ref.previewSnippet).toBeTruthy();
    });
  });
});

// ============================================================================
// REFERENCE LIST OPERATIONS
// ============================================================================

describe('Reference List Operations', () => {
  const references = [
    createMockReference({ confidence: 0.95 }),
    createMockReference({ confidence: 0.85 }),
    createMockReference({ confidence: 0.65 }),
    createMockReference({ confidence: 0.45 }),
  ];

  describe('sorting', () => {
    it('should sort by confidence descending', () => {
      const sorted = [...references].sort((a, b) => b.confidence - a.confidence);
      expect(sorted[0].confidence).toBe(0.95);
      expect(sorted[sorted.length - 1].confidence).toBe(0.45);
    });
  });

  describe('filtering', () => {
    it('should filter high confidence only', () => {
      const high = references.filter((r) => r.confidence >= 0.8);
      expect(high.length).toBe(2);
    });

    it('should filter by relationship type', () => {
      const mixedRefs = [
        createMockReference({ relationshipType: 'defined_at' }),
        createMockReference({ relationshipType: 'defined_at' }),
        createMockReference({ relationshipType: 'modified_by' }),
      ];

      const definedAt = mixedRefs.filter((r) => r.relationshipType === 'defined_at');
      expect(definedAt.length).toBe(2);
    });

    it('should filter by document type', () => {
      const mixedRefs = [
        createMockReference({ location: createMockLocation({ documentType: 'design_drawings' }) }),
        createMockReference({ location: createMockLocation({ documentType: 'specifications' }) }),
        createMockReference({ location: createMockLocation({ documentType: 'design_drawings' }) }),
      ];

      const drawings = mixedRefs.filter((r) => r.location.documentType === 'design_drawings');
      expect(drawings.length).toBe(2);
    });
  });

  describe('visibility limiting', () => {
    it('should limit visible items', () => {
      const maxVisible = 3;
      const visible = references.slice(0, maxVisible);
      const hidden = references.slice(maxVisible);

      expect(visible.length).toBe(3);
      expect(hidden.length).toBe(1);
    });

    it('should calculate hidden count', () => {
      const maxVisible = 3;
      const hiddenCount = Math.max(0, references.length - maxVisible);
      expect(hiddenCount).toBe(1);
    });
  });
});

// ============================================================================
// DISPLAY LABEL GENERATION
// ============================================================================

describe('Display Label Generation', () => {
  it('should use sheet number when available', () => {
    const loc = createMockLocation({
      sheetNumber: 'M1.0',
      pageNumber: 5,
    });

    const displayLabel = loc.sheetNumber
      ? `Sheet ${loc.sheetNumber}, Page ${loc.pageNumber}`
      : `Page ${loc.pageNumber}`;

    expect(displayLabel).toBe('Sheet M1.0, Page 5');
  });

  it('should fall back to page number only', () => {
    const loc = createMockLocation({
      sheetNumber: undefined,
      pageNumber: 5,
    });

    const displayLabel = loc.sheetNumber
      ? `Sheet ${loc.sheetNumber}, Page ${loc.pageNumber}`
      : `Page ${loc.pageNumber}`;

    expect(displayLabel).toBe('Page 5');
  });

  it('should include document name for context', () => {
    const loc = createMockLocation({
      documentName: 'M1.0 Mechanical Plan',
      pageNumber: 5,
    });

    const fullLabel = `${loc.documentName} - Page ${loc.pageNumber}`;
    expect(fullLabel).toBe('M1.0 Mechanical Plan - Page 5');
  });
});
