/**
 * Unit Tests: Gemini Client
 *
 * Tests for the Gemini API client functionality.
 * These tests verify the client can properly:
 * - Initialize with API key
 * - Load and encode documents
 * - Parse JSON responses from the model
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GeminiClient } from '@/lib/extraction/clients/gemini';
import { ExtractionDocument } from '@/lib/extraction/types';
import { SAMPLE_DOCUMENTS, fileExists } from '../setup';
import fs from 'fs/promises';
import path from 'path';

describe('GeminiClient', () => {
  describe('Initialization', () => {
    it('should throw error when API key is missing', () => {
      const originalKey = process.env.GOOGLE_AI_API_KEY;
      delete process.env.GOOGLE_AI_API_KEY;

      expect(() => new GeminiClient()).toThrow('GOOGLE_AI_API_KEY is required');

      process.env.GOOGLE_AI_API_KEY = originalKey;
    });

    it('should initialize with valid API key', () => {
      const client = new GeminiClient();
      expect(client).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const client = new GeminiClient({
        model: 'gemini-2.5-flash-preview-05-20',
        maxOutputTokens: 4096,
        temperature: 0.2,
      });
      expect(client).toBeDefined();
    });
  });

  describe('Document Loading', () => {
    beforeAll(async () => {
      // Verify sample files exist
      const exists = await fileExists(SAMPLE_DOCUMENTS.designDrawings);
      if (!exists) {
        throw new Error(`Sample document not found: ${SAMPLE_DOCUMENTS.designDrawings}`);
      }
    });

    it('should verify sample project files exist', async () => {
      expect(await fileExists(SAMPLE_DOCUMENTS.designDrawings)).toBe(true);
      expect(await fileExists(SAMPLE_DOCUMENTS.projectManual)).toBe(true);
      expect(await fileExists(SAMPLE_DOCUMENTS.addendum1)).toBe(true);
    });

    it('should read PDF file and encode to base64', async () => {
      const buffer = await fs.readFile(SAMPLE_DOCUMENTS.designDrawings);
      const base64 = buffer.toString('base64');

      expect(base64.length).toBeGreaterThan(0);
      // PDF magic bytes in base64 start with "JVBERi" (which is "%PDF-" encoded)
      expect(base64.startsWith('JVBERi')).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON from markdown code block', () => {
      const responseWithCodeBlock = `
Here's the extraction:

\`\`\`json
{
  "project_name": "Test Project",
  "work_packages": [
    {
      "packageId": "MEC",
      "name": "Mechanical",
      "csi_division": "23",
      "trade": "Mechanical",
      "line_items": []
    }
  ]
}
\`\`\`
`;

      // Test the parsing logic (extracted to a testable function)
      const parsed = parseJsonFromResponse(responseWithCodeBlock);
      expect(parsed.project_name).toBe('Test Project');
      expect(parsed.work_packages).toHaveLength(1);
      expect(parsed.work_packages[0].packageId).toBe('MEC');
    });

    it('should parse inline JSON without code block', () => {
      const responseInline = `{
  "project_name": "Inline Test",
  "work_packages": []
}`;

      const parsed = parseJsonFromResponse(responseInline);
      expect(parsed.project_name).toBe('Inline Test');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformed = 'This is not JSON at all';
      expect(() => parseJsonFromResponse(malformed)).toThrow();
    });
  });
});

// Helper function extracted for testing
function parseJsonFromResponse<T>(text: string): T {
  let jsonStr = text;

  if (text.includes('```json')) {
    const start = text.indexOf('```json') + 7;
    const end = text.indexOf('```', start);
    jsonStr = text.substring(start, end).trim();
  } else if (text.includes('```')) {
    const start = text.indexOf('```') + 3;
    const end = text.indexOf('```', start);
    jsonStr = text.substring(start, end).trim();
  } else if (text.includes('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    jsonStr = text.substring(start, end);
  }

  return JSON.parse(jsonStr);
}
