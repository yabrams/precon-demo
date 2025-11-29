/**
 * Page Classifier Unit Tests
 *
 * Tests for the page classification module including:
 * - Sheet prefix classification
 * - Content-based classification
 * - Document classification and grouping
 */

import { describe, it, expect } from 'vitest';
import {
  classifyBySheetPrefix,
  classifyByContent,
  classifyPage,
  classifyDocument,
  getPagesByTrade,
  getPagesByCSI,
  getUnclassifiedPages,
  estimateTradeTokens,
  SHEET_PREFIX_MAP,
  CSI_DIVISIONS,
} from '@/lib/extraction/page-classifier';
import { ProcessedPage, PageType } from '@/lib/pdf-utils';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function createMockPage(
  pageNumber: number,
  options: Partial<{
    sheetNumber: string;
    textContent: string;
    estimatedType: PageType;
    estimatedTokens: number;
  }> = {}
): ProcessedPage {
  const {
    sheetNumber,
    textContent = '',
    estimatedType = 'plan',
    estimatedTokens = 5000,
  } = options;

  return {
    pageNumber,
    sheetNumber,
    textContent,
    textPreview: textContent.slice(0, 100),
    estimatedTokens,
    width: 1000,
    height: 1400,
    hasText: textContent.length > 50,
    estimatedType,
    imageBuffer: Buffer.from('mock-image'),
    contentType: 'image/jpeg',
  };
}

// ============================================================================
// SHEET PREFIX CLASSIFICATION TESTS
// ============================================================================

describe('classifyBySheetPrefix', () => {
  describe('single character prefixes', () => {
    it('should classify M sheets as Mechanical', () => {
      const result = classifyBySheetPrefix('M1.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Mechanical');
      expect(result!.csiDivision).toBe('23');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should classify E sheets as Electrical', () => {
      const result = classifyBySheetPrefix('E2.1');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Electrical');
      expect(result!.csiDivision).toBe('26');
    });

    it('should classify P sheets as Plumbing', () => {
      const result = classifyBySheetPrefix('P1.01');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Plumbing');
      expect(result!.csiDivision).toBe('22');
    });

    it('should classify A sheets as Architectural', () => {
      const result = classifyBySheetPrefix('A3.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Architectural');
      expect(result!.csiDivision).toBe('06');
    });

    it('should classify S sheets as Structural', () => {
      const result = classifyBySheetPrefix('S1.1');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Structural');
      expect(result!.csiDivision).toBe('03');
    });

    it('should classify C sheets as Civil', () => {
      const result = classifyBySheetPrefix('C2.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Civil');
      expect(result!.csiDivision).toBe('31');
    });

    it('should classify G sheets as General', () => {
      const result = classifyBySheetPrefix('G0.1');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('General');
      expect(result!.csiDivision).toBe('01');
    });
  });

  describe('two character prefixes', () => {
    it('should classify FP sheets as Fire Protection', () => {
      const result = classifyBySheetPrefix('FP1.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Fire Protection');
      expect(result!.csiDivision).toBe('21');
      expect(result!.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should classify FA sheets as Fire Alarm', () => {
      const result = classifyBySheetPrefix('FA2.1');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Fire Alarm');
      expect(result!.csiDivision).toBe('28');
    });

    it('should classify SP sheets as Fire Protection (Sprinkler)', () => {
      const result = classifyBySheetPrefix('SP1.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Fire Protection');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty sheet number', () => {
      const result = classifyBySheetPrefix('');
      expect(result).toBeNull();
    });

    it('should return null for unknown prefix', () => {
      const result = classifyBySheetPrefix('X1.0');
      expect(result).toBeNull();
    });

    it('should handle lowercase prefixes', () => {
      const result = classifyBySheetPrefix('m1.0');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Mechanical');
    });

    it('should handle sheet numbers with dashes', () => {
      const result = classifyBySheetPrefix('M-1');
      expect(result).not.toBeNull();
      expect(result!.trade).toBe('Mechanical');
    });
  });
});

// ============================================================================
// CONTENT-BASED CLASSIFICATION TESTS
// ============================================================================

describe('classifyByContent', () => {
  it('should classify content with HVAC keywords as Mechanical', () => {
    const result = classifyByContent(
      'This page shows HVAC ductwork and diffuser locations for the mechanical room'
    );
    expect(result).not.toBeNull();
    expect(result!.trade).toBe('Mechanical');
    expect(result!.matchedKeywords.length).toBeGreaterThanOrEqual(2);
  });

  it('should classify content with electrical keywords', () => {
    const result = classifyByContent(
      'Electrical panel schedule showing circuit breakers and transformer'
    );
    expect(result).not.toBeNull();
    expect(result!.trade).toBe('Electrical');
    expect(result!.csiDivision).toBe('26');
  });

  it('should classify content with plumbing keywords', () => {
    const result = classifyByContent(
      'Plumbing fixture schedule with lavatory and toilet connections'
    );
    expect(result).not.toBeNull();
    expect(result!.trade).toBe('Plumbing');
    expect(result!.csiDivision).toBe('22');
  });

  it('should classify content with fire protection keywords', () => {
    const result = classifyByContent(
      'Fire suppression sprinkler system with standpipe and fire pump'
    );
    expect(result).not.toBeNull();
    expect(result!.trade).toBe('Fire Protection');
    expect(result!.csiDivision).toBe('21');
  });

  it('should classify content with structural keywords', () => {
    const result = classifyByContent(
      'Structural foundation plan showing concrete footings and column reinforcement'
    );
    expect(result).not.toBeNull();
    expect(result!.trade).toBe('Structural');
    expect(result!.csiDivision).toBe('03');
  });

  it('should require at least 2 keyword matches', () => {
    // Only one keyword
    const result = classifyByContent('The ductwork is shown here');
    // Should still work with 1 keyword if strict
    expect(result).toBeNull();
  });

  it('should return null for generic content', () => {
    const result = classifyByContent('This is a general page with no specific keywords');
    expect(result).toBeNull();
  });

  it('should return matched keywords', () => {
    const result = classifyByContent('HVAC system with ductwork and diffuser');
    expect(result).not.toBeNull();
    expect(result!.matchedKeywords).toContain('hvac');
    expect(result!.matchedKeywords).toContain('ductwork');
    expect(result!.matchedKeywords).toContain('diffuser');
  });
});

// ============================================================================
// PAGE CLASSIFICATION TESTS
// ============================================================================

describe('classifyPage', () => {
  it('should prefer sheet prefix over content', () => {
    const page = createMockPage(1, {
      sheetNumber: 'M1.0',
      textContent: 'This page has electrical keywords like panel and circuit',
    });

    const result = classifyPage(page);

    // Should use sheet prefix (Mechanical), not content (Electrical)
    expect(result.trade).toBe('Mechanical');
    expect(result.method).toBe('pattern');
  });

  it('should fall back to content classification', () => {
    const page = createMockPage(1, {
      sheetNumber: undefined,
      textContent: 'HVAC mechanical ductwork and diffuser layout',
    });

    const result = classifyPage(page);

    expect(result.trade).toBe('Mechanical');
    expect(result.method).toBe('content');
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  it('should use default classification as last resort', () => {
    const page = createMockPage(1, {
      sheetNumber: undefined,
      textContent: 'Generic content without keywords',
      estimatedType: 'plan',
    });

    const result = classifyPage(page);

    expect(result.method).toBe('default');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should classify specification pages', () => {
    const page = createMockPage(1, {
      sheetNumber: undefined,
      textContent: 'A'.repeat(600), // Long text content
      estimatedType: 'specification',
    });

    const result = classifyPage(page);

    expect(result.pageType).toBe('specification');
  });
});

// ============================================================================
// DOCUMENT CLASSIFICATION TESTS
// ============================================================================

describe('classifyDocument', () => {
  it('should classify all pages in a document', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }),
      createMockPage(2, { sheetNumber: 'M1.1' }),
      createMockPage(3, { sheetNumber: 'E1.0' }),
      createMockPage(4, { sheetNumber: 'P1.0' }),
    ];

    const result = classifyDocument(pages);

    expect(result.totalPages).toBe(4);
    expect(result.classifications.length).toBe(4);
    expect(result.tradeGroups.size).toBeGreaterThan(0);
  });

  it('should group pages by trade', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }),
      createMockPage(2, { sheetNumber: 'M1.1' }),
      createMockPage(3, { sheetNumber: 'M2.0' }),
      createMockPage(4, { sheetNumber: 'E1.0' }),
    ];

    const result = classifyDocument(pages);

    const mechPages = result.tradeGroups.get('Mechanical');
    expect(mechPages).toBeDefined();
    expect(mechPages!.length).toBe(3);

    const elecPages = result.tradeGroups.get('Electrical');
    expect(elecPages).toBeDefined();
    expect(elecPages!.length).toBe(1);
  });

  it('should group pages by CSI division', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }), // CSI 23
      createMockPage(2, { sheetNumber: 'P1.0' }), // CSI 22
      createMockPage(3, { sheetNumber: 'FP1.0' }), // CSI 21
    ];

    const result = classifyDocument(pages);

    expect(result.csiGroups.has('23')).toBe(true);
    expect(result.csiGroups.has('22')).toBe(true);
    expect(result.csiGroups.has('21')).toBe(true);
  });

  it('should provide summary statistics', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }),
      createMockPage(2, { sheetNumber: 'M2.0' }),
      createMockPage(3, { sheetNumber: 'E1.0' }),
    ];

    const result = classifyDocument(pages);

    expect(result.summary.tradesIdentified).toContain('Mechanical');
    expect(result.summary.tradesIdentified).toContain('Electrical');
    expect(result.summary.pagesPerTrade['Mechanical']).toBe(2);
    expect(result.summary.pagesPerTrade['Electrical']).toBe(1);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getPagesByTrade', () => {
  it('should return pages for a specific trade', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }),
      createMockPage(2, { sheetNumber: 'M1.1' }),
      createMockPage(3, { sheetNumber: 'E1.0' }),
    ];

    const classified = classifyDocument(pages);
    const mechPages = getPagesByTrade(classified, 'Mechanical');

    expect(mechPages.length).toBe(2);
    expect(mechPages[0].pageNumber).toBe(1);
    expect(mechPages[1].pageNumber).toBe(2);
  });

  it('should return empty array for non-existent trade', () => {
    const pages = [createMockPage(1, { sheetNumber: 'M1.0' })];
    const classified = classifyDocument(pages);

    const nonExistent = getPagesByTrade(classified, 'NonExistent');
    expect(nonExistent).toEqual([]);
  });
});

describe('getPagesByCSI', () => {
  it('should return pages for a specific CSI division', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }), // CSI 23
      createMockPage(2, { sheetNumber: 'P1.0' }), // CSI 22
    ];

    const classified = classifyDocument(pages);
    const csi23Pages = getPagesByCSI(classified, '23');

    expect(csi23Pages.length).toBe(1);
    expect(csi23Pages[0].pageNumber).toBe(1);
  });
});

describe('getUnclassifiedPages', () => {
  it('should return low-confidence pages', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }), // High confidence
      createMockPage(2, { sheetNumber: undefined, textContent: 'generic' }), // Low confidence
    ];

    const classified = classifyDocument(pages);
    const unclassified = getUnclassifiedPages(classified, 0.5);

    expect(unclassified.length).toBe(1);
    expect(unclassified[0].pageNumber).toBe(2);
  });

  it('should respect confidence threshold', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0' }), // 0.9 confidence
    ];

    const classified = classifyDocument(pages);

    // With high threshold, even good classifications are "unclassified"
    const strictUnclassified = getUnclassifiedPages(classified, 0.95);
    expect(strictUnclassified.length).toBe(1);

    // With low threshold, nothing is unclassified
    const looseUnclassified = getUnclassifiedPages(classified, 0.5);
    expect(looseUnclassified.length).toBe(0);
  });
});

describe('estimateTradeTokens', () => {
  it('should sum tokens for trade pages', () => {
    const pages = [
      createMockPage(1, { sheetNumber: 'M1.0', estimatedTokens: 5000 }),
      createMockPage(2, { sheetNumber: 'M1.1', estimatedTokens: 6000 }),
      createMockPage(3, { sheetNumber: 'E1.0', estimatedTokens: 4000 }),
    ];

    const classified = classifyDocument(pages);
    const mechClassifications = getPagesByTrade(classified, 'Mechanical');
    const tokens = estimateTradeTokens(pages, mechClassifications);

    expect(tokens).toBe(11000); // 5000 + 6000
  });

  it('should return 0 for empty classification', () => {
    const pages = [createMockPage(1, { sheetNumber: 'M1.0' })];
    const classified = classifyDocument(pages);

    const emptyClassifications = getPagesByTrade(classified, 'NonExistent');
    const tokens = estimateTradeTokens(pages, emptyClassifications);

    expect(tokens).toBe(0);
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  it('should have all expected sheet prefixes', () => {
    const expectedPrefixes = ['M', 'E', 'P', 'A', 'S', 'C', 'G', 'FP', 'FA'];
    for (const prefix of expectedPrefixes) {
      expect(SHEET_PREFIX_MAP[prefix]).toBeDefined();
    }
  });

  it('should have all expected CSI divisions', () => {
    const expectedDivisions = ['01', '03', '06', '21', '22', '23', '26', '27'];
    for (const division of expectedDivisions) {
      expect(CSI_DIVISIONS[division]).toBeDefined();
    }
  });

  it('should have valid CSI division format', () => {
    for (const key of Object.keys(CSI_DIVISIONS)) {
      expect(key).toMatch(/^\d{2}$/); // Two digits
    }
  });
});
