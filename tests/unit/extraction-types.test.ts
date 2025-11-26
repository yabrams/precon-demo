/**
 * Unit Tests: Extraction Types
 *
 * Tests for type validation and data structure integrity.
 * Ensures our types correctly represent extraction data.
 */

import { describe, it, expect } from 'vitest';
import {
  ExtractionConfig,
  DEFAULT_EXTRACTION_CONFIG,
  ExtractedWorkPackage,
  ExtractedLineItem,
  AIObservation,
  ConfidenceScore,
  CSIClassification,
  ExtractionMetadata,
  DocumentReference,
  ExtractionSession,
  ExtractionStatus,
} from '@/lib/extraction/types';

describe('Extraction Types', () => {
  describe('ExtractionConfig', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_EXTRACTION_CONFIG.primaryModel).toBe('gemini-2.5-pro');
      expect(DEFAULT_EXTRACTION_CONFIG.validationModel).toBe('claude-sonnet-4.5');
      expect(DEFAULT_EXTRACTION_CONFIG.enableIterativeRefinement).toBe(true);
      expect(DEFAULT_EXTRACTION_CONFIG.maxPasses).toBe(3);
      expect(DEFAULT_EXTRACTION_CONFIG.minimumConfidence).toBe(0.5);
      expect(DEFAULT_EXTRACTION_CONFIG.flagThreshold).toBe(0.7);
    });

    it('should allow partial config override', () => {
      const customConfig: Partial<ExtractionConfig> = {
        maxPasses: 5,
        minimumConfidence: 0.7,
      };

      const merged = { ...DEFAULT_EXTRACTION_CONFIG, ...customConfig };

      expect(merged.maxPasses).toBe(5);
      expect(merged.minimumConfidence).toBe(0.7);
      expect(merged.primaryModel).toBe('gemini-2.5-pro'); // Unchanged
    });
  });

  describe('CSIClassification', () => {
    it('should represent valid CSI division', () => {
      const csi: CSIClassification = {
        divisionCode: '23',
        divisionName: 'HVAC',
        sectionCode: '23 81 26',
        sectionName: 'Packaged Rooftop Units',
        level: 3,
        confidence: 0.95,
        reasoning: 'Equipment schedule clearly shows Daikin RTUs',
      };

      expect(csi.divisionCode).toMatch(/^\d{2}$/);
      expect(csi.level).toBeGreaterThanOrEqual(1);
      expect(csi.level).toBeLessThanOrEqual(4);
      expect(csi.confidence).toBeGreaterThanOrEqual(0);
      expect(csi.confidence).toBeLessThanOrEqual(1);
    });

    it('should support alternative classifications', () => {
      const csi: CSIClassification = {
        divisionCode: '07',
        divisionName: 'Thermal & Moisture Protection',
        level: 1,
        confidence: 0.7,
        reasoning: 'Roofing scope identified',
        alternativeClassifications: [
          {
            code: '06',
            name: 'Wood, Plastics, Composites',
            confidence: 0.3,
            reasoning: 'Some wood decking involved',
          },
        ],
      };

      expect(csi.alternativeClassifications).toHaveLength(1);
      expect(csi.alternativeClassifications![0].code).toBe('06');
    });
  });

  describe('ConfidenceScore', () => {
    it('should have all required components', () => {
      const confidence: ConfidenceScore = {
        overall: 0.85,
        components: {
          dataCompleteness: 0.9,
          sourceClarity: 0.8,
          crossReferenceMatch: 0.85,
          specificationMatch: 0.9,
          quantityReasonableness: 0.8,
        },
        reasoning: 'High confidence extraction from equipment schedule',
        flags: [],
      };

      expect(confidence.overall).toBeGreaterThan(0);
      expect(Object.keys(confidence.components)).toHaveLength(5);
    });

    it('should support confidence flags', () => {
      const confidence: ConfidenceScore = {
        overall: 0.6,
        components: {
          dataCompleteness: 0.5,
          sourceClarity: 0.7,
          crossReferenceMatch: 0.5,
          specificationMatch: 0.7,
          quantityReasonableness: 0.6,
        },
        reasoning: 'Some items need verification',
        flags: [
          {
            type: 'warning',
            code: 'MISSING_QTY',
            message: 'Quantity not specified in source document',
            affectedFields: ['quantity'],
            suggestedAction: 'Manual takeoff required',
          },
        ],
      };

      expect(confidence.flags).toHaveLength(1);
      expect(confidence.flags[0].type).toBe('warning');
    });
  });

  describe('ExtractedLineItem', () => {
    it('should represent a complete line item', () => {
      const item: ExtractedLineItem = {
        id: 'item-001',
        itemNumber: 'MEC-01',
        description: 'RTU-1 (Racquetball)',
        action: 'Replace',
        quantity: 1,
        unit: 'EA',
        specifications: '4 Ton; Daikin 048; Gas/Electric; 1600 CFM',
        notes: 'Coordinate with electrical for power connection',
        references: [],
        order: 0,
        extraction: {
          extractedBy: 'gemini-2.5-pro',
          extractedAt: new Date(),
          confidence: {
            overall: 0.9,
            components: {
              dataCompleteness: 0.95,
              sourceClarity: 0.9,
              crossReferenceMatch: 0.85,
              specificationMatch: 0.9,
              quantityReasonableness: 0.9,
            },
            reasoning: 'Clear equipment schedule entry',
            flags: [],
          },
          humanReviewed: false,
          extractionPass: 1,
        },
      };

      expect(item.id).toBeDefined();
      expect(item.description).toBeTruthy();
      expect(item.action).toBeTruthy();
      expect(item.extraction.extractedBy).toBe('gemini-2.5-pro');
    });

    it('should allow optional fields to be undefined', () => {
      const minimalItem: ExtractedLineItem = {
        id: 'item-002',
        description: 'Demolish existing roofing',
        action: 'Demo',
        references: [],
        order: 0,
        extraction: {
          extractedBy: 'gemini-2.5-pro',
          extractedAt: new Date(),
          confidence: {
            overall: 0.7,
            components: {
              dataCompleteness: 0.5,
              sourceClarity: 0.8,
              crossReferenceMatch: 0.7,
              specificationMatch: 0.7,
              quantityReasonableness: 0.7,
            },
            reasoning: 'Demo item without specific quantity',
            flags: [],
          },
          humanReviewed: false,
          extractionPass: 1,
        },
      };

      expect(minimalItem.quantity).toBeUndefined();
      expect(minimalItem.unit).toBeUndefined();
      expect(minimalItem.itemNumber).toBeUndefined();
    });
  });

  describe('AIObservation', () => {
    it('should represent a critical observation', () => {
      const observation: AIObservation = {
        id: 'obs-001',
        severity: 'critical',
        category: 'warranty_requirement',
        title: 'Warranty Conflict Resolved',
        insight:
          'Addendum 2 requires 5/8" GP Dens Deck for 20-year/120mph warranty. Ensure bid reflects this specific material cost.',
        affectedWorkPackages: ['ARC-02'],
        affectedLineItems: ['item-roofing-001'],
        references: [],
        suggestedActions: [
          'Verify coverboard specification with supplier',
          'Update unit price to reflect Dens Deck',
        ],
        extraction: {
          extractedBy: 'gemini-2.5-pro',
          extractedAt: new Date(),
          confidence: {
            overall: 0.95,
            components: {
              dataCompleteness: 0.95,
              sourceClarity: 0.95,
              crossReferenceMatch: 0.95,
              specificationMatch: 0.95,
              quantityReasonableness: 0.95,
            },
            reasoning: 'Clear addendum reference',
            flags: [],
          },
          humanReviewed: false,
          extractionPass: 3,
        },
      };

      expect(observation.severity).toBe('critical');
      expect(observation.category).toBe('warranty_requirement');
      expect(observation.affectedWorkPackages).toContain('ARC-02');
    });

    it('should support all severity levels', () => {
      const severities: AIObservation['severity'][] = ['critical', 'warning', 'info'];
      severities.forEach((severity) => {
        expect(['critical', 'warning', 'info']).toContain(severity);
      });
    });

    it('should support all observation categories', () => {
      const categories: AIObservation['category'][] = [
        'scope_conflict',
        'specification_mismatch',
        'quantity_concern',
        'coordination_required',
        'addendum_impact',
        'warranty_requirement',
        'code_compliance',
        'risk_flag',
        'cost_impact',
        'schedule_impact',
        'missing_information',
        'substitution_available',
      ];

      expect(categories).toHaveLength(12);
    });
  });

  describe('ExtractionStatus', () => {
    it('should have all valid status values', () => {
      const statuses: ExtractionStatus[] = [
        'initializing',
        'pass_1_extracting',
        'pass_2_reviewing',
        'pass_3_validating',
        'awaiting_review',
        'completed',
        'failed',
      ];

      expect(statuses).toHaveLength(7);
    });
  });

  describe('DocumentReference', () => {
    it('should represent a document reference with bounding box', () => {
      const ref: DocumentReference = {
        id: 'ref-001',
        location: {
          documentId: 'doc-001',
          documentName: '2032_kenai_rec_center_upgrades_100.pdf',
          documentType: 'design_drawings',
          pageNumber: 5,
          sheetNumber: 'M0.1',
          boundingBox: {
            x: 0.2,
            y: 0.3,
            width: 0.4,
            height: 0.1,
          },
        },
        relationshipType: 'defined_at',
        confidence: 0.9,
        extractedBy: 'gemini-2.5-pro',
        reasoning: 'Equipment schedule shows RTU specifications',
        displayLabel: 'Sheet M0.1 - Equipment Schedule',
        previewSnippet: 'RTU-1: 4 Ton Daikin 048',
      };

      expect(ref.location.boundingBox).toBeDefined();
      expect(ref.location.boundingBox!.x).toBeGreaterThanOrEqual(0);
      expect(ref.location.boundingBox!.x).toBeLessThanOrEqual(1);
      expect(ref.relationshipType).toBe('defined_at');
    });

    it('should support text range for specifications', () => {
      const ref: DocumentReference = {
        id: 'ref-002',
        location: {
          documentId: 'doc-002',
          documentName: 'kenai_rec_center_upgrades_project_manual.pdf',
          documentType: 'specifications',
          pageNumber: 45,
          textRange: {
            startLine: 120,
            endLine: 125,
            highlightText: 'Provide Daikin or approved equal...',
          },
        },
        relationshipType: 'spec_section',
        confidence: 0.85,
        extractedBy: 'gemini-2.5-pro',
        displayLabel: 'Spec 23 81 26 - Packaged Rooftop Units',
      };

      expect(ref.location.textRange).toBeDefined();
      expect(ref.location.textRange!.highlightText).toContain('Daikin');
    });

    it('should support all relationship types', () => {
      const types: DocumentReference['relationshipType'][] = [
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

      expect(types).toHaveLength(9);
    });
  });
});
