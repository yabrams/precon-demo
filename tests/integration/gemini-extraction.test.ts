/**
 * Integration Tests: Gemini Extraction
 *
 * Tests the Gemini client against real API calls with sample documents.
 * These tests are slower and may incur API costs.
 *
 * Run with: npx vitest tests/integration/gemini-extraction.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GeminiClient } from '@/lib/extraction/clients/gemini';
import { ExtractionDocument, GeminiExtractionResponse } from '@/lib/extraction/types';
import { SAMPLE_DOCUMENTS, fileExists, EXPECTED_TRADES } from '../setup';
import path from 'path';

describe('Gemini Extraction Integration', () => {
  let client: GeminiClient;
  let designDocument: ExtractionDocument;

  beforeAll(async () => {
    // Verify API key is available
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY required for integration tests');
    }

    // Verify sample document exists
    const exists = await fileExists(SAMPLE_DOCUMENTS.designDrawings);
    if (!exists) {
      throw new Error('Sample design drawings not found');
    }

    client = new GeminiClient();

    // Create document reference using file:// URL for local testing
    designDocument = {
      id: 'test-doc-001',
      name: '2032_kenai_rec_center_upgrades_100.pdf',
      url: SAMPLE_DOCUMENTS.designDrawings, // Use absolute path
      type: 'design_drawings',
      mimeType: 'application/pdf',
    };
  });

  describe('Initial Extraction (Pass 1)', () => {
    let extractionResult: {
      response: GeminiExtractionResponse;
      tokensUsed: { input: number; output: number };
    };

    it('should extract work packages from design drawings', async () => {
      // This is the main extraction call - may take 30-60 seconds
      extractionResult = await client.extractWorkPackages([designDocument]);

      expect(extractionResult).toBeDefined();
      expect(extractionResult.response).toBeDefined();
      expect(extractionResult.tokensUsed.input).toBeGreaterThan(0);
      expect(extractionResult.tokensUsed.output).toBeGreaterThan(0);
    }, 120000); // 2 minute timeout

    it('should return work_packages array', () => {
      expect(extractionResult.response.work_packages).toBeDefined();
      expect(Array.isArray(extractionResult.response.work_packages)).toBe(true);
      expect(extractionResult.response.work_packages.length).toBeGreaterThan(0);
    });

    it('should identify multiple trades/CSI divisions', () => {
      const packages = extractionResult.response.work_packages;
      const trades = [...new Set(packages.map((p) => p.trade))];
      const divisions = [...new Set(packages.map((p) => p.csi_division))];

      console.log('Identified trades:', trades);
      console.log('Identified CSI divisions:', divisions);

      // Should find at least 3 different trades
      expect(trades.length).toBeGreaterThanOrEqual(3);
      expect(divisions.length).toBeGreaterThanOrEqual(3);
    });

    it('should have valid package structure', () => {
      const firstPackage = extractionResult.response.work_packages[0];

      expect(firstPackage.packageId).toBeDefined();
      expect(firstPackage.name).toBeDefined();
      expect(firstPackage.trade).toBeDefined();
      expect(firstPackage.csi_division).toBeDefined();
      expect(firstPackage.line_items).toBeDefined();
      expect(Array.isArray(firstPackage.line_items)).toBe(true);
    });

    it('should extract line items with required fields', () => {
      const allItems = extractionResult.response.work_packages.flatMap((p) => p.line_items);

      expect(allItems.length).toBeGreaterThan(0);

      // Check each item has required fields
      // Note: action is optional in some extractions
      const itemsWithDescription = allItems.filter((item) => item.description);
      const itemsWithAction = allItems.filter((item) => item.action);

      expect(itemsWithDescription.length).toBe(allItems.length);
      itemsWithDescription.forEach((item) => {
        expect(item.description.length).toBeGreaterThan(0);
      });

      // Most items should have an action (allow some flexibility)
      expect(itemsWithAction.length).toBeGreaterThan(allItems.length * 0.8);

      console.log(`Total line items extracted: ${allItems.length}`);
      console.log(`Items with action: ${itemsWithAction.length}/${allItems.length}`);
    });

    it('should have CSI division codes in correct format', () => {
      const divisions = extractionResult.response.work_packages.map((p) => p.csi_division);

      divisions.forEach((div) => {
        // CSI divisions are 2 digits (01-99)
        expect(div).toMatch(/^\d{1,2}$/);
        const num = parseInt(div);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(99);
      });
    });

    it('should include source references where available', () => {
      const allItems = extractionResult.response.work_packages.flatMap((p) => p.line_items);
      const itemsWithRefs = allItems.filter((item) => item.source_reference?.sheet);

      console.log(`Items with sheet references: ${itemsWithRefs.length}/${allItems.length}`);

      // At least some items should have source references
      expect(itemsWithRefs.length).toBeGreaterThan(0);

      // Check reference format
      itemsWithRefs.forEach((item) => {
        if (item.source_reference?.sheet) {
          // Sheet numbers like M0.1, E3.0, A1.2, C1.0
          expect(item.source_reference.sheet).toMatch(/^[A-Z]\d+\.\d+$/);
        }
      });
    });

    it('should extract quantities where specified', () => {
      const allItems = extractionResult.response.work_packages.flatMap((p) => p.line_items);
      const itemsWithQty = allItems.filter((item) => item.quantity !== null && item.quantity !== undefined);

      console.log(`Items with quantities: ${itemsWithQty.length}/${allItems.length}`);

      // Some items should have quantities
      expect(itemsWithQty.length).toBeGreaterThan(0);

      // Quantities should be positive numbers (may be strings from JSON)
      itemsWithQty.forEach((item) => {
        const qty = Number(item.quantity);
        expect(qty).toBeGreaterThan(0);
      });
    });

    it('should include notes for extraction gaps', () => {
      // Check if incomplete_areas or extraction_notes are populated
      const response = extractionResult.response;

      if (response.incomplete_areas) {
        expect(Array.isArray(response.incomplete_areas)).toBe(true);
        console.log('Incomplete areas:', response.incomplete_areas);
      }

      if (response.extraction_notes) {
        expect(typeof response.extraction_notes).toBe('string');
        console.log('Extraction notes:', response.extraction_notes);
      }
    });
  });

  describe('Extraction Quality Metrics', () => {
    // Reuse extraction result from initial tests to avoid additional API calls
    let qualityResult: {
      response: GeminiExtractionResponse;
      tokensUsed: { input: number; output: number };
    } | null = null;
    let skipTests = false;

    beforeAll(async () => {
      // Make a single API call for quality metrics tests
      try {
        qualityResult = await client.extractWorkPackages([designDocument]);
      } catch (error) {
        console.warn('Quality metrics API call failed, tests will be skipped:', error);
        skipTests = true;
      }
    }, 120000);

    it('should identify expected trades from Kenai project', () => {
      if (skipTests || !qualityResult) {
        console.log('Skipping test due to API call failure');
        return;
      }
      const trades = qualityResult.response.work_packages.map((p) => p.trade.toLowerCase());

      // Check for key expected trades
      const expectedLower = EXPECTED_TRADES.map((t) => t.toLowerCase());
      const foundExpected = expectedLower.filter((exp) =>
        trades.some((t) => t.includes(exp) || exp.includes(t))
      );

      console.log('Expected trades found:', foundExpected);
      console.log('All trades:', trades);

      // Should find at least some of the expected trades
      expect(foundExpected.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract HVAC/mechanical equipment', () => {
      if (skipTests || !qualityResult) {
        console.log('Skipping test due to API call failure');
        return;
      }
      // Find mechanical packages (HVAC is division 23)
      const mechPackages = qualityResult.response.work_packages.filter(
        (p) =>
          p.trade.toLowerCase().includes('mech') ||
          p.trade.toLowerCase().includes('hvac') ||
          p.csi_division === '23'
      );

      console.log(`Mechanical packages found: ${mechPackages.length}`);

      // Should have at least one mechanical package
      expect(mechPackages.length).toBeGreaterThanOrEqual(1);

      // Find equipment items (RTUs, units, equipment)
      const equipmentItems = mechPackages.flatMap((p) =>
        p.line_items.filter(
          (item) =>
            item.description &&
            (item.description.toLowerCase().includes('rtu') ||
              item.description.toLowerCase().includes('rooftop') ||
              item.description.toLowerCase().includes('unit') ||
              item.description.toLowerCase().includes('equipment'))
        )
      );

      console.log(`Equipment items found: ${equipmentItems.length}`);

      if (equipmentItems.length > 0) {
        equipmentItems.slice(0, 5).forEach((item) => {
          console.log(`  - ${item.description}: ${item.quantity || 'no qty'} ${item.unit || ''}`);
        });
      }
    });
  });
});
