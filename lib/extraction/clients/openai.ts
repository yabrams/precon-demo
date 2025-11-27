/**
 * OpenAI API Client
 *
 * Handles communication with OpenAI's GPT-4o model for document extraction.
 * Converts PDFs to images since OpenAI vision API only supports image types.
 */

import OpenAI from 'openai';
import { readFile } from 'fs/promises';
import path from 'path';
import { pdf } from 'pdf-to-img';
import {
  GeminiExtractionResponse,
  GeminiReviewResponse,
  ExtractionDocument,
  GeminiAIObservation,
} from '../types';

export interface OpenAIClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAIClient {
  private client: OpenAI;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: OpenAIClientConfig = {}) {
    const apiKey = config.apiKey || process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      throw new Error('OPEN_AI_API_KEY is required');
    }

    this.client = new OpenAI({ apiKey });
    this.modelName = config.model || process.env.OPENAI_MODEL || 'gpt-4o';
    this.maxTokens = config.maxTokens || 16384;
    this.temperature = config.temperature || 0.1;
  }

  /**
   * Load a document and convert to base64 for OpenAI
   * For PDFs, converts to array of page images
   */
  private async loadDocument(doc: ExtractionDocument): Promise<{ base64: string; mimeType: string }[]> {
    let buffer: Buffer;

    if (doc.url.startsWith('/uploads/')) {
      const filepath = path.join(process.cwd(), 'public', doc.url);
      buffer = await readFile(filepath);
    } else if (doc.url.startsWith('/') || doc.url.match(/^[A-Za-z]:\\/)) {
      buffer = await readFile(doc.url);
    } else if (doc.url.startsWith('http')) {
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${doc.url}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unsupported document URL: ${doc.url}`);
    }

    // For PDFs, convert each page to PNG image
    if (doc.mimeType === 'application/pdf') {
      const images: { base64: string; mimeType: string }[] = [];
      const pdfDocument = await pdf(buffer, { scale: 1.5 }); // Higher scale for better quality

      let pageNum = 0;
      for await (const page of pdfDocument) {
        pageNum++;
        // page is a Buffer containing PNG data
        images.push({
          base64: page.toString('base64'),
          mimeType: 'image/png',
        });
        // Limit to first 20 pages to avoid token limits
        if (pageNum >= 20) {
          console.log(`  [OpenAI] Limiting PDF to first 20 pages`);
          break;
        }
      }

      console.log(`  [OpenAI] Converted PDF to ${images.length} page images`);
      return images;
    }

    // For images, return single item array
    return [{
      base64: buffer.toString('base64'),
      mimeType: doc.mimeType,
    }];
  }

  /**
   * Build content array for OpenAI messages
   */
  private async buildContent(
    documents: ExtractionDocument[],
    textPrompt: string
  ): Promise<OpenAI.Chat.ChatCompletionContentPart[]> {
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

    // Add images first (OpenAI prefers visual content before text)
    // PDFs are converted to page images by loadDocument
    for (const doc of documents) {
      const images = await this.loadDocument(doc);

      for (const { base64, mimeType } of images) {
        if (mimeType.startsWith('image/')) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high',
            },
          });
        }
      }
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: textPrompt,
    });

    return content;
  }

  /**
   * Parse JSON response from OpenAI, handling markdown code blocks
   */
  private parseJsonResponse<T>(text: string): T {
    // Try direct parse first
    try {
      return JSON.parse(text);
    } catch {
      // Look for JSON in markdown code blocks
      const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        return JSON.parse(jsonBlockMatch[1].trim());
      }

      // Try to find JSON array or object
      const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse model response as JSON');
    }
  }

  /**
   * Run initial extraction (Pass 1)
   */
  async extractWorkPackages(
    documents: ExtractionDocument[],
    customInstructions?: string
  ): Promise<{
    response: GeminiExtractionResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const systemPrompt = `You are an expert construction estimator and document analyst. Your task is to extract structured bid information from construction documents.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.

Analyze the provided construction documents and extract:
1. Work packages organized by CSI MasterFormat divisions
2. Detailed line items with quantities, units, and specifications
3. Source references for each item
4. AI observations about risks, coordination needs, or issues

${customInstructions || ''}`;

    const extractionPrompt = `Analyze these construction documents and extract all work packages.

Return a JSON object with this EXACT structure:
{
  "project_name": "string",
  "work_packages": [
    {
      "packageId": "string (e.g., MEC, ELEC, PLMB, DEMO, ROOF)",
      "name": "string",
      "csi_division": "string (e.g., Division 23)",
      "trade": "string",
      "description": "string",
      "scope_responsible": "string",
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "action": "string (Install, Demo, Replace, etc.)",
          "quantity": "number or null",
          "unit": "string (EA, LF, SF, LS, etc.)",
          "specifications": "string or null",
          "notes": "string or null",
          "source_reference": {
            "sheet": "string",
            "location": "string",
            "page": "number"
          },
          "confidence": "number 0-1",
          "flags": ["string array - VERIFY_QTY, VERIFY_SPEC, etc."]
        }
      ],
      "confidence": {
        "overall": "number 0-1",
        "reasoning": "string"
      }
    }
  ],
  "ai_observations": [
    {
      "severity": "critical | warning | info",
      "category": "risk_flag | coordination_required | missing_information | etc.",
      "title": "string",
      "insight": "string",
      "affected_packages": ["string array"],
      "suggested_actions": ["string array"],
      "source_reference": {
        "sheet": "string",
        "page": "number"
      }
    }
  ],
  "extraction_confidence": "number 0-1"
}

Be thorough and extract ALL work items visible in the documents.`;

    const content = await this.buildContent(documents, extractionPrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    const parsed = this.parseJsonResponse<GeminiExtractionResponse>(responseText);

    // Handle array-wrapped responses (normalize to single object)
    const normalizedResponse = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      response: normalizedResponse,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }

  /**
   * Run self-review pass (Pass 2)
   */
  async selfReview(
    documents: ExtractionDocument[],
    previousExtraction: GeminiExtractionResponse
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const systemPrompt = `You are a senior construction estimator reviewing an initial extraction. Your task is to find missed items and correct errors.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.`;

    const reviewPrompt = `Review this initial extraction and find anything that was missed or needs correction.

PREVIOUS EXTRACTION:
${JSON.stringify(previousExtraction, null, 2)}

CRITICAL REVIEW CHECKLIST:
1. Check each equipment schedule for missed items
2. Look for demolition notes that were overlooked
3. Find items in sheet notes/general notes
4. Check specifications sections for requirements
5. Look for addendum changes
6. Verify quantities match the documents

Return a JSON object with this EXACT structure:
{
  "additions": [
    {
      "packageId": "string",
      "line_item": {
        "item_number": "string or null",
        "description": "string",
        "action": "string",
        "quantity": "number or null",
        "unit": "string",
        "specifications": "string or null",
        "notes": "string or null",
        "source_reference": {
          "sheet": "string",
          "location": "string",
          "page": "number"
        },
        "confidence": "number 0-1",
        "flags": ["string array"]
      }
    }
  ],
  "modifications": [
    {
      "packageId": "string",
      "item_number": "string",
      "updates": {
        "quantity": "number",
        "unit": "string",
        "specifications": "string",
        "notes": "string"
      }
    }
  ],
  "new_packages": [],
  "gaps_identified": ["string array"],
  "confidence_adjustments": [],
  "ai_observations": [
    {
      "severity": "critical | warning | info",
      "category": "string",
      "title": "string",
      "insight": "string",
      "affected_packages": ["string array"],
      "suggested_actions": ["string array"]
    }
  ],
  "overall_assessment": {
    "extraction_completeness": "number 0-1",
    "data_quality": "number 0-1",
    "risk_level": "low | medium | high",
    "summary": "string"
  }
}`;

    const content = await this.buildContent(documents, reviewPrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);
    const normalizedResponse = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      response: normalizedResponse,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }

  /**
   * Run trade deep-dive pass (Pass 3)
   */
  async tradeDeepDive(
    documents: ExtractionDocument[],
    previousResult: GeminiExtractionResponse,
    focusTrades: string[] = ['Mechanical', 'Electrical', 'Plumbing']
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const systemPrompt = `You are a specialized MEP (Mechanical, Electrical, Plumbing) estimator performing a detailed review.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.`;

    const deepDivePrompt = `Perform a deep-dive analysis on these specific trades: ${focusTrades.join(', ')}

CURRENT EXTRACTION:
${JSON.stringify(previousResult, null, 2)}

DEEP-DIVE CHECKLIST:
1. Equipment schedules - verify every item is captured
2. Demolition requirements - check demo notes on each sheet
3. System testing requirements (TAB, commissioning, etc.)
4. Insulation requirements
5. Coordination items between trades
6. Specialty items (VFDs, controls, sensors, etc.)
7. Connections to existing systems

Return the same JSON structure as the review pass with any additions, modifications, and observations.`;

    const content = await this.buildContent(documents, deepDivePrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);
    const normalizedResponse = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      response: normalizedResponse,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }

  /**
   * Run cross-validation pass (Pass 4)
   */
  async crossValidation(
    documents: ExtractionDocument[],
    previousResult: GeminiExtractionResponse
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const systemPrompt = `You are an independent construction estimator validating another team's extraction. Be critical and thorough.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.`;

    const validationPrompt = `As an independent validator, review this extraction against the source documents.

EXTRACTION TO VALIDATE:
${JSON.stringify(previousResult, null, 2)}

VALIDATION CHECKLIST:
1. Are all quantities accurate per the documents?
2. Are there any items that shouldn't be included?
3. Are there items missing that should be included?
4. Are the CSI classifications correct?
5. Are source references accurate?
6. Are there any coordination issues not flagged?

Return the review JSON structure with:
- additions: items that were missed
- modifications: corrections to existing items
- ai_observations: validation findings and concerns`;

    const content = await this.buildContent(documents, validationPrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);
    const normalizedResponse = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      response: normalizedResponse,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }

  /**
   * Run final validation pass (Pass 5)
   */
  async finalValidation(
    documents: ExtractionDocument[],
    currentState: GeminiExtractionResponse,
    allPreviousObservations: GeminiAIObservation[]
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const systemPrompt = `You are a chief estimator performing final quality assurance on a bid extraction.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.`;

    const finalPrompt = `Perform final validation on this extraction that has gone through multiple review passes.

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

PREVIOUS OBSERVATIONS:
${JSON.stringify(allPreviousObservations, null, 2)}

FINAL QA CHECKLIST:
1. Remove any duplicate items
2. Verify critical items are not missing
3. Confirm high-risk observations are valid
4. Ensure quantities are reasonable
5. Check for any obvious errors

Return the review JSON structure with final adjustments and confidence assessment.`;

    const content = await this.buildContent(documents, finalPrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';
    const parsed = this.parseJsonResponse<GeminiReviewResponse>(responseText);
    const normalizedResponse = Array.isArray(parsed) ? parsed[0] : parsed;

    return {
      response: normalizedResponse,
      tokensUsed: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
    };
  }
}
