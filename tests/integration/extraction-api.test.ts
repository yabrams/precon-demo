/**
 * Integration Tests: Extraction API Routes
 *
 * Tests for the extraction API endpoints.
 * Note: These tests use mocks for database operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma before importing routes
vi.mock('@/lib/prisma', () => ({
  prisma: {
    buildingConnectedProject: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-project-id',
        name: 'Test Project',
        bcProjectId: 'BC123',
      }),
    },
    diagram: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          fileName: 'test.pdf',
          fileUrl: '/uploads/test.pdf',
          fileType: 'application/pdf',
        },
      ]),
    },
    extractionSession: {
      create: vi.fn().mockResolvedValue({ id: 'session-123' }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 'session-123') {
          return Promise.resolve({
            id: 'session-123',
            status: 'completed',
            currentPass: 5,
            progress: 100,
            metrics: JSON.stringify({
              totalWorkPackages: 3,
              totalLineItems: 15,
              totalObservations: 5,
            }),
            workPackages: [],
            observations: [],
          });
        }
        return Promise.resolve(null);
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    extractedWorkPackageRecord: {
      create: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
    },
    extractedLineItemRecord: {
      create: vi.fn().mockResolvedValue({ id: 'item-1' }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        id: 'item-1',
        humanCorrections: null,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    aIObservationRecord: {
      create: vi.fn().mockResolvedValue({ id: 'obs-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    predictionRecord: {
      create: vi.fn().mockResolvedValue({ id: 'pred-1' }),
    },
  },
}));

describe('Extraction API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/extraction/start', () => {
    it('should require projectId', async () => {
      const request = new Request('http://localhost/api/extraction/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Import route handler after mocks are set up
      const { POST } = await import('@/app/api/extraction/start/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('projectId');
    });

    it('should require documentIds', async () => {
      const request = new Request('http://localhost/api/extraction/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'test-project-id' }),
      });

      const { POST } = await import('@/app/api/extraction/start/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('documentIds');
    });
  });

  describe('GET /api/extraction/[sessionId]', () => {
    it('should return 404 for non-existent session', async () => {
      const request = new Request('http://localhost/api/extraction/non-existent', {
        method: 'GET',
      });

      const { GET } = await import('@/app/api/extraction/[sessionId]/route');
      const response = await GET(request, {
        params: Promise.resolve({ sessionId: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return session status for existing session', async () => {
      const request = new Request('http://localhost/api/extraction/session-123', {
        method: 'GET',
      });

      const { GET } = await import('@/app/api/extraction/[sessionId]/route');
      const response = await GET(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('session-123');
      expect(data.status).toBe('completed');
    });
  });

  describe('POST /api/extraction/[sessionId]/correct', () => {
    it('should require correction fields for single correction', async () => {
      const request = new Request('http://localhost/api/extraction/session-123/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const { POST } = await import('@/app/api/extraction/[sessionId]/correct/route');
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should accept batch corrections', async () => {
      const request = new Request('http://localhost/api/extraction/session-123/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrections: [
            {
              type: 'line_item',
              lineItemId: 'item-1',
              workPackageId: 'pkg-1',
              corrections: { quantity: 10 },
            },
          ],
          reviewerId: 'user-123',
        }),
      });

      const { POST } = await import('@/app/api/extraction/[sessionId]/correct/route');
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metrics.applied).toBe(1);
    });
  });
});
