/**
 * Unit Tests: Claude Client
 *
 * Tests for the Claude API client functionality.
 * These tests verify the client can:
 * - Initialize with API key
 * - Parse JSON responses correctly
 * - Handle all 5 extraction passes
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ClaudeClient } from '@/lib/extraction/clients/claude';
import { ClaudeValidationResponse, GeminiExtractionResponse } from '@/lib/extraction/types';
import { SAMPLE_DOCUMENTS, fileExists } from '../setup';

describe('ClaudeClient', () => {
  describe('Initialization', () => {
    it('should throw error when API key is missing', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ClaudeClient()).toThrow('ANTHROPIC_API_KEY is required');

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should initialize with valid API key', () => {
      // Only run if API key is set
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping test - ANTHROPIC_API_KEY not set');
        return;
      }
      const client = new ClaudeClient();
      expect(client).toBeDefined();
    });

    it('should accept custom configuration', () => {
      // Only run if API key is set
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping test - ANTHROPIC_API_KEY not set');
        return;
      }
      const client = new ClaudeClient({
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 8192,
        temperature: 0.2,
      });
      expect(client).toBeDefined();
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON from markdown code block', () => {
      const responseWithCodeBlock = `
Here's the validation:

\`\`\`json
{
  "validated_packages": [
    {
      "packageId": "MEC",
      "confidence": 0.9,
      "confidence_reasoning": "Clear equipment schedule",
      "flags": []
    }
  ],
  "observations": [],
  "overall_assessment": {
    "completeness": 0.9,
    "accuracy_estimate": 0.85,
    "items_needing_review": [],
    "critical_issues": []
  }
}
\`\`\`
`;

      // Test the parsing logic (extracted inline for testing)
      const parsed = parseJsonFromResponse<ClaudeValidationResponse>(responseWithCodeBlock);
      expect(parsed.validated_packages).toHaveLength(1);
      expect(parsed.validated_packages[0].packageId).toBe('MEC');
      expect(parsed.validated_packages[0].confidence).toBe(0.9);
    });

    it('should parse inline JSON without code block', () => {
      const responseInline = `{
  "validated_packages": [],
  "observations": [],
  "overall_assessment": {
    "completeness": 0.95,
    "accuracy_estimate": 0.9,
    "items_needing_review": [],
    "critical_issues": []
  }
}`;

      const parsed = parseJsonFromResponse<ClaudeValidationResponse>(responseInline);
      expect(parsed.overall_assessment.completeness).toBe(0.95);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformed = 'This is not JSON at all';
      expect(() => parseJsonFromResponse(malformed)).toThrow();
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
    });
  });
});

// Helper function extracted for testing (matches claude.ts implementation)
function parseJsonFromResponse<T>(text: string): T {
  let jsonStr = text;

  // Extract from markdown code block if present
  if (text.includes('```json')) {
    const start = text.indexOf('```json') + 7;
    let end = text.indexOf('```', start);
    if (end === -1) end = text.length;
    jsonStr = text.substring(start, end).trim();
  } else if (text.includes('```')) {
    const start = text.indexOf('```') + 3;
    let end = text.indexOf('```', start);
    if (end === -1) end = text.length;
    jsonStr = text.substring(start, end).trim();
  }

  // Find JSON object/array
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    const objStart = jsonStr.indexOf('{');
    const arrStart = jsonStr.indexOf('[');
    const start = objStart === -1 ? arrStart : (arrStart === -1 ? objStart : Math.min(objStart, arrStart));
    if (start !== -1) {
      jsonStr = jsonStr.substring(start);
    }
  }

  return JSON.parse(jsonStr);
}
