/**
 * AIObservationsPanel Unit Tests
 *
 * Tests for the AI Observations Panel component functionality
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AIObservation,
  ObservationSeverity,
  ObservationCategory,
  DocumentReference,
} from '@/lib/extraction/types';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockObservation(
  overrides: Partial<AIObservation> = {}
): AIObservation {
  return {
    id: `obs_${Math.random().toString(36).substr(2, 9)}`,
    severity: 'warning',
    category: 'scope_conflict',
    title: 'Test Observation',
    insight: 'This is a test observation insight',
    affectedWorkPackages: ['MEC', 'ELE'],
    affectedLineItems: ['item_1', 'item_2'],
    references: [],
    suggestedActions: ['Review the scope', 'Coordinate with electrical'],
    extraction: {
      extractedBy: 'gemini-2.5-pro',
      extractedAt: new Date(),
      confidence: {
        overall: 0.85,
        components: {
          dataCompleteness: 0.9,
          sourceClarity: 0.8,
          crossReferenceMatch: 0.85,
          specificationMatch: 0.9,
          quantityReasonableness: 0.8,
        },
        reasoning: 'High confidence based on clear references',
        flags: [],
      },
      humanReviewed: false,
      extractionPass: 4,
    },
    userAcknowledged: false,
    ...overrides,
  };
}

function createMockReference(
  overrides: Partial<DocumentReference> = {}
): DocumentReference {
  return {
    id: `ref_${Math.random().toString(36).substr(2, 9)}`,
    location: {
      documentId: 'doc_123',
      documentName: 'M1.0 Mechanical Plan',
      documentType: 'design_drawings',
      pageNumber: 1,
      sheetNumber: 'M1.0',
    },
    relationshipType: 'defined_at',
    confidence: 0.9,
    extractedBy: 'gemini-2.5-pro',
    displayLabel: 'Sheet M1.0, Page 1',
    previewSnippet: 'RTU-1 installation detail',
    ...overrides,
  };
}

// ============================================================================
// OBSERVATION DATA TESTS
// ============================================================================

describe('AIObservation Data Structure', () => {
  describe('observation creation', () => {
    it('should create valid observation with required fields', () => {
      const obs = createMockObservation();

      expect(obs.id).toBeTruthy();
      expect(obs.severity).toBe('warning');
      expect(obs.category).toBe('scope_conflict');
      expect(obs.title).toBeTruthy();
      expect(obs.insight).toBeTruthy();
      expect(obs.affectedWorkPackages).toHaveLength(2);
    });

    it('should create critical severity observation', () => {
      const obs = createMockObservation({ severity: 'critical' });
      expect(obs.severity).toBe('critical');
    });

    it('should create info severity observation', () => {
      const obs = createMockObservation({ severity: 'info' });
      expect(obs.severity).toBe('info');
    });
  });

  describe('observation categories', () => {
    const categories: ObservationCategory[] = [
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

    it('should support all observation categories', () => {
      for (const category of categories) {
        const obs = createMockObservation({ category });
        expect(obs.category).toBe(category);
      }
    });
  });

  describe('user interaction', () => {
    it('should track user acknowledgment', () => {
      const obs = createMockObservation({ userAcknowledged: true });
      expect(obs.userAcknowledged).toBe(true);
    });

    it('should track user response', () => {
      const obs = createMockObservation({
        userResponse: 'Acknowledged and will coordinate',
        userResponseAt: new Date(),
      });
      expect(obs.userResponse).toBe('Acknowledged and will coordinate');
      expect(obs.userResponseAt).toBeInstanceOf(Date);
    });
  });

  describe('references', () => {
    it('should include document references', () => {
      const ref = createMockReference();
      const obs = createMockObservation({ references: [ref] });

      expect(obs.references).toHaveLength(1);
      expect(obs.references[0].location.sheetNumber).toBe('M1.0');
    });

    it('should support multiple references', () => {
      const refs = [
        createMockReference({ location: { ...createMockReference().location, sheetNumber: 'M1.0' } }),
        createMockReference({ location: { ...createMockReference().location, sheetNumber: 'E1.0' } }),
      ];
      const obs = createMockObservation({ references: refs });

      expect(obs.references).toHaveLength(2);
    });
  });
});

// ============================================================================
// OBSERVATION FILTERING TESTS
// ============================================================================

describe('Observation Filtering Logic', () => {
  const observations: AIObservation[] = [
    createMockObservation({ id: 'obs_1', severity: 'critical' }),
    createMockObservation({ id: 'obs_2', severity: 'critical' }),
    createMockObservation({ id: 'obs_3', severity: 'warning' }),
    createMockObservation({ id: 'obs_4', severity: 'warning' }),
    createMockObservation({ id: 'obs_5', severity: 'warning' }),
    createMockObservation({ id: 'obs_6', severity: 'info' }),
  ];

  it('should filter by severity - all', () => {
    const filtered = observations;
    expect(filtered).toHaveLength(6);
  });

  it('should filter by severity - critical only', () => {
    const filtered = observations.filter((o) => o.severity === 'critical');
    expect(filtered).toHaveLength(2);
  });

  it('should filter by severity - warning only', () => {
    const filtered = observations.filter((o) => o.severity === 'warning');
    expect(filtered).toHaveLength(3);
  });

  it('should filter by severity - info only', () => {
    const filtered = observations.filter((o) => o.severity === 'info');
    expect(filtered).toHaveLength(1);
  });

  it('should count unacknowledged observations', () => {
    const unacknowledged = observations.filter((o) => !o.userAcknowledged);
    expect(unacknowledged).toHaveLength(6);
  });

  it('should count acknowledged observations', () => {
    const withAcknowledged = [
      ...observations.slice(0, 3),
      createMockObservation({ id: 'obs_7', userAcknowledged: true }),
    ];
    const acknowledged = withAcknowledged.filter((o) => o.userAcknowledged);
    expect(acknowledged).toHaveLength(1);
  });
});

// ============================================================================
// OBSERVATION GROUPING TESTS
// ============================================================================

describe('Observation Grouping Logic', () => {
  const observations: AIObservation[] = [
    createMockObservation({ severity: 'critical', category: 'scope_conflict' }),
    createMockObservation({ severity: 'critical', category: 'code_compliance' }),
    createMockObservation({ severity: 'warning', category: 'scope_conflict' }),
    createMockObservation({ severity: 'warning', category: 'quantity_concern' }),
    createMockObservation({ severity: 'info', category: 'missing_information' }),
  ];

  it('should group by severity', () => {
    const groups: Record<ObservationSeverity, AIObservation[]> = {
      critical: [],
      warning: [],
      info: [],
    };

    for (const obs of observations) {
      groups[obs.severity].push(obs);
    }

    expect(groups.critical).toHaveLength(2);
    expect(groups.warning).toHaveLength(2);
    expect(groups.info).toHaveLength(1);
  });

  it('should group by category', () => {
    const groups = new Map<ObservationCategory, AIObservation[]>();

    for (const obs of observations) {
      const existing = groups.get(obs.category) || [];
      existing.push(obs);
      groups.set(obs.category, existing);
    }

    expect(groups.get('scope_conflict')).toHaveLength(2);
    expect(groups.get('code_compliance')).toHaveLength(1);
    expect(groups.get('quantity_concern')).toHaveLength(1);
    expect(groups.get('missing_information')).toHaveLength(1);
  });

  it('should group by affected work package', () => {
    const obsWithPackages = [
      createMockObservation({ affectedWorkPackages: ['MEC', 'ELE'] }),
      createMockObservation({ affectedWorkPackages: ['MEC', 'PLU'] }),
      createMockObservation({ affectedWorkPackages: ['ELE'] }),
    ];

    const packageGroups = new Map<string, AIObservation[]>();

    for (const obs of obsWithPackages) {
      for (const pkgId of obs.affectedWorkPackages) {
        const existing = packageGroups.get(pkgId) || [];
        existing.push(obs);
        packageGroups.set(pkgId, existing);
      }
    }

    expect(packageGroups.get('MEC')).toHaveLength(2);
    expect(packageGroups.get('ELE')).toHaveLength(2);
    expect(packageGroups.get('PLU')).toHaveLength(1);
  });
});

// ============================================================================
// OBSERVATION STATS TESTS
// ============================================================================

describe('Observation Statistics', () => {
  const observations = [
    createMockObservation({ severity: 'critical', userAcknowledged: false }),
    createMockObservation({ severity: 'critical', userAcknowledged: true }),
    createMockObservation({ severity: 'warning', userAcknowledged: false }),
    createMockObservation({ severity: 'warning', userAcknowledged: false }),
    createMockObservation({ severity: 'info', userAcknowledged: true }),
  ];

  it('should calculate total count', () => {
    expect(observations.length).toBe(5);
  });

  it('should calculate critical count', () => {
    const critical = observations.filter((o) => o.severity === 'critical');
    expect(critical.length).toBe(2);
  });

  it('should calculate warning count', () => {
    const warnings = observations.filter((o) => o.severity === 'warning');
    expect(warnings.length).toBe(2);
  });

  it('should calculate info count', () => {
    const info = observations.filter((o) => o.severity === 'info');
    expect(info.length).toBe(1);
  });

  it('should calculate unacknowledged count', () => {
    const unack = observations.filter((o) => !o.userAcknowledged);
    expect(unack.length).toBe(3);
  });
});
