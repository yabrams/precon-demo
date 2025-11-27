/**
 * Claude API Client for Extraction
 *
 * Handles communication with Anthropic's Claude models for document extraction.
 * Supports native PDF processing and all 5 extraction passes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  GeminiExtractionResponse,
  GeminiReviewResponse,
  ClaudeValidationResponse,
  ExtractionDocument,
  GeminiRawWorkPackage,
} from '../types';

export interface ClaudeClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

type DocumentMediaType = 'application/pdf';
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type ContentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: DocumentMediaType; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
  | { type: 'text'; text: string };

export class ClaudeClient {
  private client: Anthropic;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: ClaudeClientConfig = {}) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({ apiKey });
    this.modelName = config.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
    this.maxTokens = config.maxTokens || 16384;
    this.temperature = config.temperature || 0.1;
  }

  /**
   * Load a document file buffer
   */
  private async loadDocumentBuffer(doc: ExtractionDocument): Promise<Buffer> {
    if (doc.url.startsWith('/uploads/')) {
      const filepath = path.join(process.cwd(), 'public', doc.url);
      return await readFile(filepath);
    } else if (doc.url.startsWith('/') || doc.url.match(/^[A-Za-z]:\\/)) {
      return await readFile(doc.url);
    } else if (doc.url.startsWith('http')) {
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${doc.url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } else {
      throw new Error(`Unsupported document URL: ${doc.url}`);
    }
  }

  /**
   * Load a document to Claude-compatible format
   * Claude supports native PDF via 'document' type
   */
  private async loadDocument(doc: ExtractionDocument): Promise<ContentBlock> {
    const buffer = await this.loadDocumentBuffer(doc);
    const base64 = buffer.toString('base64');

    // PDF - use native document type
    if (doc.mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      };
    }

    // Images
    let mediaType: ImageMediaType = 'image/jpeg';
    if (doc.mimeType.includes('png')) mediaType = 'image/png';
    else if (doc.mimeType.includes('gif')) mediaType = 'image/gif';
    else if (doc.mimeType.includes('webp')) mediaType = 'image/webp';

    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };
  }

  /**
   * Build content array with documents
   */
  private async buildContent(documents: ExtractionDocument[], textPrompt: string): Promise<ContentBlock[]> {
    const content: ContentBlock[] = [];

    for (const doc of documents) {
      try {
        const docContent = await this.loadDocument(doc);
        content.push(docContent);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    if (content.length === 0) {
      throw new Error('No documents could be loaded');
    }

    content.push({ type: 'text', text: textPrompt });
    return content;
  }

  /**
   * Pass 1: Initial Extraction
   */
  async extractWorkPackages(
    documents: ExtractionDocument[],
    customInstructions?: string
  ): Promise<{
    response: GeminiExtractionResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const content = await this.buildContent(documents, this.buildPass1Prompt(customInstructions));

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: content as Anthropic.MessageCreateParams['messages'][0]['content'] }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = this.parseJsonResponse<GeminiExtractionResponse>(responseText);

    return {
      response: parsed,
      tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  }

  /**
   * Pass 2: Self-Review
   */
  async reviewExtraction(
    documents: ExtractionDocument[],
    previousExtraction: GeminiExtractionResponse
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const content = await this.buildContent(
      documents,
      this.buildPass2Prompt(JSON.stringify(previousExtraction, null, 2))
    );

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: content as Anthropic.MessageCreateParams['messages'][0]['content'] }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);

    return {
      response: parsed,
      tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  }

  /**
   * Pass 3: Trade Deep-Dive
   * Focus on specific trades that need more detailed extraction
   */
  async tradeDeepDive(
    documents: ExtractionDocument[],
    currentExtraction: GeminiExtractionResponse,
    focusTrades: string[]
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const content = await this.buildContent(
      documents,
      this.buildPass3Prompt(JSON.stringify(currentExtraction, null, 2), focusTrades)
    );

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: content as Anthropic.MessageCreateParams['messages'][0]['content'] }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);

    return {
      response: parsed,
      tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  }

  /**
   * Pass 4: Cross-Model Validation
   * Validate extraction from another model
   */
  async crossValidation(
    documents: ExtractionDocument[],
    extraction: GeminiExtractionResponse
  ): Promise<{
    response: ClaudeValidationResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const content = await this.buildContent(
      documents,
      this.buildPass4Prompt(JSON.stringify(extraction, null, 2))
    );

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: content as Anthropic.MessageCreateParams['messages'][0]['content'] }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = this.parseJsonResponse<ClaudeValidationResponse>(responseText);

    return {
      response: parsed,
      tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  }

  /**
   * Pass 5: Final Validation & Quality Check
   * Final review with focus on completeness and accuracy
   */
  async finalValidation(
    documents: ExtractionDocument[],
    extraction: GeminiExtractionResponse,
    previousObservations: string
  ): Promise<{
    response: ClaudeValidationResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const content = await this.buildContent(
      documents,
      this.buildPass5Prompt(JSON.stringify(extraction, null, 2), previousObservations)
    );

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: content as Anthropic.MessageCreateParams['messages'][0]['content'] }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = this.parseJsonResponse<ClaudeValidationResponse>(responseText);

    return {
      response: parsed,
      tokensUsed: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  }

  // Alias for backward compatibility
  async validateExtraction(
    documents: ExtractionDocument[],
    extraction: GeminiExtractionResponse
  ): Promise<{
    response: ClaudeValidationResponse;
    tokensUsed: { input: number; output: number };
  }> {
    return this.crossValidation(documents, extraction);
  }

  /**
   * Parse JSON from model response
   */
  private parseJsonResponse<T>(text: string): T {
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

    try {
      return JSON.parse(jsonStr);
    } catch {
      const repairedJson = this.repairTruncatedJson(jsonStr);
      try {
        return JSON.parse(repairedJson);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        console.error('Raw text:', text.substring(0, 500));
        throw new Error('Failed to parse model response as JSON');
      }
    }
  }

  /**
   * Repair truncated JSON
   */
  private repairTruncatedJson(json: string): string {
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < json.length; i++) {
      const char = json[i];
      if (escape) { escape = false; continue; }
      if (char === '\\' && inString) { escape = true; continue; }
      if (char === '"' && !escape) { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' && stack.length && stack[stack.length - 1] === '{') stack.pop();
      else if (char === ']' && stack.length && stack[stack.length - 1] === '[') stack.pop();
    }

    if (inString) json += '"';

    const lastCompleteComma = json.lastIndexOf(',');
    const lastCompleteBrace = json.lastIndexOf('}');
    const lastCompleteBracket = json.lastIndexOf(']');

    if (stack.length > 0 && lastCompleteComma > Math.max(lastCompleteBrace, lastCompleteBracket)) {
      json = json.substring(0, lastCompleteComma);
    }

    while (stack.length > 0) {
      const open = stack.pop();
      json += open === '{' ? '}' : ']';
    }

    return json;
  }

  // ============================================================================
  // PROMPTS FOR ALL 5 PASSES
  // ============================================================================

  private buildPass1Prompt(customInstructions?: string): string {
    return `You are a senior preconstruction estimator analyzing construction documents.

TASK: Extract all work packages (scopes of work) from these construction documents with FULL TRACEABILITY.

For each work package found, identify:
1. Trade/CSI Division (use MasterFormat classification)
2. Individual line items with:
   - Item description
   - Action (Install, Replace, Demo, Repair, etc.)
   - Quantity (if visible)
   - Unit of measure (SF, LF, EA, CY, etc.)
   - Specifications/notes
   - **DOCUMENT REFERENCE with bounding box coordinates** (REQUIRED)
   - Confidence level for each item

3. **AI OBSERVATIONS** - Your expert insights about:
   - Potential risks or concerns
   - Missing information that could affect pricing
   - Coordination requirements between trades
   - Warranty or specification requirements
   - Code compliance considerations

CSI MASTERFORMAT DIVISIONS:
- Division 01: General Requirements
- Division 02: Existing Conditions (demo, abatement)
- Division 03: Concrete
- Division 04: Masonry
- Division 05: Metals
- Division 06: Wood, Plastics, Composites
- Division 07: Thermal & Moisture Protection
- Division 08: Openings (doors, windows)
- Division 09: Finishes
- Division 21: Fire Suppression
- Division 22: Plumbing
- Division 23: HVAC
- Division 26: Electrical
- Division 27: Communications
- Division 31: Earthwork
- Division 32: Exterior Improvements
- Division 33: Utilities

${customInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

IMPORTANT:
- Be thorough - it's better to over-extract than miss items
- Include ALL visible trades, even if you see only one item
- Note quantities exactly as shown
- Reference specific sheet numbers (e.g., "M0.1", "E3.0")
- PROVIDE BOUNDING BOX COORDINATES [y_min, x_min, y_max, x_max] (0-1000 normalized)
- Flag anything unclear with "NEEDS_REVIEW"
- Look for equipment schedules, fixture schedules, and keynotes

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "project_name": "string or null",
  "work_packages": [
    {
      "packageId": "string (e.g., MEC, ELE, CIV)",
      "name": "string",
      "csi_division": "string",
      "trade": "string",
      "description": "string",
      "scope_responsible": "string or null",
      "confidence": { "overall": 0.85, "reasoning": "string" },
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "action": "string",
          "quantity": "number or null",
          "unit": "string or null",
          "specifications": "string or null",
          "notes": "string or null",
          "source_reference": {
            "sheet": "string",
            "location": "string",
            "page": "number",
            "bounding_box": [y_min, x_min, y_max, x_max]
          },
          "confidence": 0.9,
          "flags": []
        }
      ]
    }
  ],
  "ai_observations": [
    {
      "severity": "critical | warning | info",
      "category": "string",
      "title": "string",
      "insight": "string",
      "affected_packages": [],
      "suggested_actions": []
    }
  ],
  "extraction_confidence": 0.85,
  "incomplete_areas": [],
  "extraction_notes": "string"
}`;
  }

  private buildPass2Prompt(previousExtraction: string): string {
    return `You previously extracted the following work packages:

${previousExtraction}

TASK: Perform a CRITICAL REVIEW and find items you missed.

## SPECIFIC CHECKS:
1. Count equipment items in schedules - do your counts match?
2. Check for demolition items - often overlooked
3. Look for "N.I.C." or "By Others" notes
4. Check general notes for hidden requirements
5. Look for accessories, supports, appurtenances
6. Check for testing, balancing, commissioning requirements
7. Verify all trades are represented

## PROVIDE EXPERT OBSERVATIONS:
A. **RISKS & CONCERNS** - What could go wrong?
B. **COORDINATION** - What needs coordination between trades?
C. **PRICING CONCERNS** - What's unclear for pricing?
D. **CODE & COMPLIANCE** - Any code issues?
E. **WARRANTY & CLOSEOUT** - Special requirements?

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "additions": [
    {
      "work_package": "packageId to add to",
      "description": "string",
      "action": "string",
      "quantity": "number or null",
      "unit": "string or null",
      "source_reference": { "sheet": "string", "page": "number" },
      "confidence": 0.85,
      "reason_missed": "why this was missed"
    }
  ],
  "modifications": [
    { "original_item_ref": "string", "changes": {}, "reason": "string" }
  ],
  "new_packages": [],
  "gaps_identified": [],
  "ai_observations": [
    {
      "id": "obs_001",
      "severity": "critical | warning | info",
      "category": "string",
      "title": "string",
      "insight": "string",
      "affected_packages": [],
      "suggested_actions": []
    }
  ],
  "overall_assessment": {
    "extraction_completeness": 0.90,
    "data_quality": 0.85,
    "risk_level": "low | medium | high",
    "summary": "string"
  }
}`;
  }

  private buildPass3Prompt(currentExtraction: string, focusTrades: string[]): string {
    return `TRADE DEEP-DIVE ANALYSIS

Current extraction:
${currentExtraction}

FOCUS TRADES: ${focusTrades.join(', ')}

TASK: Deep-dive into the focus trades and find:
1. Missing line items specific to these trades
2. Missing quantities or specifications
3. Coordination items with other trades
4. Trade-specific risks and concerns
5. Specialized equipment or materials

For each focus trade, verify:
- All equipment from schedules is captured
- All demolition for this trade is included
- Supporting items (hangers, supports, connections)
- Testing and commissioning requirements
- Specialty items and accessories

OUTPUT FORMAT:
Return ONLY valid JSON with same structure as Pass 2:
{
  "additions": [],
  "modifications": [],
  "new_packages": [],
  "gaps_identified": [],
  "ai_observations": [],
  "overall_assessment": {
    "extraction_completeness": 0.0,
    "data_quality": 0.0,
    "risk_level": "string",
    "summary": "string"
  }
}`;
  }

  private buildPass4Prompt(extraction: string): string {
    return `CROSS-MODEL VALIDATION

The following work packages were extracted by another AI model:

${extraction}

YOUR TASK: Critically validate this extraction.

## VALIDATION CHECKS:

1. **COMPLETENESS CHECK**
   - Any obvious work items MISSING?
   - All trades represented?
   - Quantities complete?

2. **ACCURACY CHECK**
   - CSI classifications correct?
   - Descriptions accurate?
   - Source references plausible?

3. **CONSISTENCY CHECK**
   - Related items make sense together?
   - Any conflicting quantities?
   - Electrical loads match mechanical equipment?

4. **RISK IDENTIFICATION**
   - Critical risks in this project?
   - Coordination issues?
   - Pricing concerns?

5. **CONFIDENCE CALIBRATION**
   - Is stated confidence reasonable?
   - Which items need human review?

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "validated_packages": [
    {
      "packageId": "string",
      "confidence": 0.85,
      "confidence_reasoning": "string",
      "flags": [
        {
          "type": "warning | info | error",
          "code": "string",
          "message": "string",
          "affectedFields": [],
          "suggestedAction": "string"
        }
      ]
    }
  ],
  "observations": [
    {
      "severity": "critical | warning | info",
      "category": "string",
      "title": "string",
      "insight": "string",
      "affected_packages": [],
      "suggested_actions": []
    }
  ],
  "overall_assessment": {
    "completeness": 0.90,
    "accuracy_estimate": 0.85,
    "items_needing_review": [],
    "critical_issues": []
  }
}`;
  }

  private buildPass5Prompt(extraction: string, previousObservations: string): string {
    return `FINAL VALIDATION & QUALITY CHECK

Extraction to validate:
${extraction}

Previous observations from earlier passes:
${previousObservations}

YOUR TASK: Final quality check before human review.

## FINAL CHECKS:

1. **OVERALL COMPLETENESS**
   - Compare against all sheets in the documents
   - Verify all work shown is captured
   - Check for scope gaps between trades

2. **DATA QUALITY**
   - All items have source references?
   - Quantities make sense?
   - No duplicate items?

3. **RISK SUMMARY**
   - Consolidate all identified risks
   - Prioritize by impact
   - Clear action items

4. **HUMAN REVIEW PRIORITIES**
   - Which items MUST be reviewed by estimator?
   - What clarifications are needed?
   - RFI candidates?

5. **FINAL CONFIDENCE ASSESSMENT**
   - Overall extraction quality score
   - Trade-by-trade confidence
   - Areas of uncertainty

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "validated_packages": [
    {
      "packageId": "string",
      "confidence": 0.85,
      "confidence_reasoning": "string",
      "flags": []
    }
  ],
  "observations": [
    {
      "severity": "critical | warning | info",
      "category": "string",
      "title": "string",
      "insight": "string",
      "affected_packages": [],
      "suggested_actions": []
    }
  ],
  "overall_assessment": {
    "completeness": 0.90,
    "accuracy_estimate": 0.85,
    "items_needing_review": [],
    "critical_issues": []
  }
}`;
  }
}

// Export singleton instance
let claudeClientInstance: ClaudeClient | null = null;

export function getClaudeClient(config?: ClaudeClientConfig): ClaudeClient {
  if (!claudeClientInstance) {
    claudeClientInstance = new ClaudeClient(config);
  }
  return claudeClientInstance;
}

// Reset singleton for testing
export function resetClaudeClient(): void {
  claudeClientInstance = null;
}
