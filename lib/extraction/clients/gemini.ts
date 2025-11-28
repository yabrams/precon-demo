/**
 * Gemini API Client
 *
 * Handles communication with Google's Gemini 2.5 Pro model for document extraction.
 * Optimized for PDF processing and long-context document analysis.
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import path from 'path';
import {
  GeminiExtractionResponse,
  GeminiReviewResponse,
  ExtractionDocument,
} from '../types';

export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private modelName: string;
  private maxOutputTokens: number;
  private temperature: number;

  constructor(config: GeminiClientConfig = {}) {
    const apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    // Default to gemini-2.5-pro for reliable extraction quality
    // gemini-3-pro-preview has quota issues on Tier 1 - switch when available
    // Can be overridden via GEMINI_MODEL env var
    this.modelName = config.model || process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    this.maxOutputTokens = config.maxOutputTokens || 65536;
    this.temperature = config.temperature || 0.1;
  }

  /**
   * Load a document and convert to Gemini-compatible format
   */
  private async loadDocument(doc: ExtractionDocument): Promise<Part> {
    let data: string;

    if (doc.url.startsWith('/uploads/')) {
      // Relative path under public/uploads
      const filepath = path.join(process.cwd(), 'public', doc.url);
      const buffer = await readFile(filepath);
      data = buffer.toString('base64');
    } else if (doc.url.startsWith('/') || doc.url.match(/^[A-Za-z]:\\/)) {
      // Absolute file path (Unix or Windows)
      const buffer = await readFile(doc.url);
      data = buffer.toString('base64');
    } else if (doc.url.startsWith('http')) {
      // Remote URL
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${doc.url}`);
      }
      const buffer = await response.arrayBuffer();
      data = Buffer.from(buffer).toString('base64');
    } else {
      throw new Error(`Unsupported document URL: ${doc.url}`);
    }

    return {
      inlineData: {
        mimeType: doc.mimeType,
        data,
      },
    };
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
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    // Build parts array with documents
    const parts: Part[] = [];

    for (const doc of documents) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    // Add the extraction prompt
    parts.push({ text: this.buildPass1Prompt(customInstructions) });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const parsed = this.parseJsonResponse<GeminiExtractionResponse>(text);

    // Get token usage
    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Run self-review (Pass 2)
   */
  async reviewExtraction(
    documents: ExtractionDocument[],
    previousExtraction: GeminiExtractionResponse
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    const parts: Part[] = [];

    // Add documents again for reference
    for (const doc of documents) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    // Add the review prompt with previous extraction
    parts.push({
      text: this.buildPass2Prompt(JSON.stringify(previousExtraction, null, 2)),
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<GeminiReviewResponse>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Run multi-document correlation
   */
  async correlateDocuments(
    allDocuments: ExtractionDocument[],
    currentPackages: GeminiExtractionResponse
  ): Promise<{
    response: GeminiExtractionResponse;
    additions: unknown[];
    modifications: unknown[];
    tokensUsed: { input: number; output: number };
  }> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    const parts: Part[] = [];

    // Load all documents
    for (const doc of allDocuments) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    // Add correlation prompt
    parts.push({
      text: this.buildCorrelationPrompt(JSON.stringify(currentPackages, null, 2)),
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<{
      updated_packages: GeminiExtractionResponse;
      additions: unknown[];
      modifications: unknown[];
    }>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return {
      response: parsed.updated_packages || currentPackages,
      additions: parsed.additions || [],
      modifications: parsed.modifications || [],
      tokensUsed,
    };
  }

  /**
   * Parse JSON from model response, handling markdown code blocks
   */
  private parseJsonResponse<T>(text: string): T {
    let jsonStr = text;

    // Extract from markdown code block if present
    if (text.includes('```json')) {
      const start = text.indexOf('```json') + 7;
      let end = text.indexOf('```', start);
      // Handle truncated response without closing ```
      if (end === -1) {
        end = text.length;
      }
      jsonStr = text.substring(start, end).trim();
    } else if (text.includes('```')) {
      const start = text.indexOf('```') + 3;
      let end = text.indexOf('```', start);
      if (end === -1) {
        end = text.length;
      }
      jsonStr = text.substring(start, end).trim();
    }

    // If still not valid JSON, try to find the JSON object/array
    if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
      const objStart = jsonStr.indexOf('{');
      const arrStart = jsonStr.indexOf('[');
      const start = objStart === -1 ? arrStart : (arrStart === -1 ? objStart : Math.min(objStart, arrStart));
      if (start !== -1) {
        jsonStr = jsonStr.substring(start);
      }
    }

    // Try to repair truncated JSON by finding the last complete structure
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try to repair truncated JSON
      const repairedJson = this.repairTruncatedJson(jsonStr);
      try {
        return JSON.parse(repairedJson);
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        console.error('Raw text:', text.substring(0, 500));
        console.error('Attempted repair:', repairedJson.substring(repairedJson.length - 200));
        throw new Error('Failed to parse model response as JSON');
      }
    }
  }

  /**
   * Attempt to repair truncated JSON by closing open brackets/braces
   */
  private repairTruncatedJson(json: string): string {
    // Track open brackets and braces
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < json.length; i++) {
      const char = json[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\' && inString) {
        escape = true;
        continue;
      }

      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length && stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }

    // Close any unclosed strings
    if (inString) {
      json += '"';
    }

    // Find last complete item if we're in the middle of a string value
    // Look for last complete key-value pair or array item
    const lastCompleteComma = json.lastIndexOf(',');
    const lastCompleteBrace = json.lastIndexOf('}');
    const lastCompleteBracket = json.lastIndexOf(']');

    // If truncated mid-value, trim back to last complete structure
    if (stack.length > 0 && lastCompleteComma > Math.max(lastCompleteBrace, lastCompleteBracket)) {
      // We're likely in an incomplete value after a comma
      json = json.substring(0, lastCompleteComma);
    }

    // Close all open structures
    while (stack.length > 0) {
      const open = stack.pop();
      json += open === '{' ? '}' : ']';
    }

    return json;
  }

  /**
   * Pass 1: Initial extraction prompt - Enhanced with bounding boxes, confidence, and observations
   */
  private buildPass1Prompt(customInstructions?: string): string {
    return `
You are a senior preconstruction estimator analyzing construction documents.

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
- Division 07: Thermal & Moisture Protection (roofing, insulation, waterproofing)
- Division 08: Openings (doors, windows, glazing)
- Division 09: Finishes (drywall, painting, flooring, ceilings)
- Division 10: Specialties
- Division 11: Equipment
- Division 12: Furnishings
- Division 13: Special Construction
- Division 14: Conveying Equipment
- Division 21: Fire Suppression
- Division 22: Plumbing
- Division 23: HVAC
- Division 26: Electrical
- Division 27: Communications
- Division 28: Electronic Safety & Security
- Division 31: Earthwork
- Division 32: Exterior Improvements
- Division 33: Utilities

${customInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ''}

IMPORTANT INSTRUCTIONS:
- Be thorough - it's better to over-extract than miss items
- Include ALL visible trades, even if you see only one item
- Note quantities exactly as shown (don't calculate or estimate)
- Reference specific sheet numbers (e.g., "M0.1", "E3.0")
- **PROVIDE BOUNDING BOX COORDINATES** for each item's source location
  - Use normalized coordinates [0-1000] relative to page dimensions
  - Format: [y_min, x_min, y_max, x_max]
- Flag anything unclear with "NEEDS_REVIEW" in flags array
- Look for equipment schedules, fixture schedules, and keynotes
- **PROVIDE CONFIDENCE SCORES** (0.0-1.0) for each work package

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure:
{
  "project_name": "string or null",
  "work_packages": [
    {
      "packageId": "string (e.g., MEC, ELE, CIV)",
      "name": "string (e.g., Mechanical - HVAC Equipment)",
      "csi_division": "string (e.g., 23)",
      "trade": "string (e.g., Mechanical)",
      "description": "string (brief scope description)",
      "scope_responsible": "string or null (e.g., HVAC Contractor)",
      "confidence": {
        "overall": 0.85,
        "reasoning": "Clear equipment schedule with quantities"
      },
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "action": "string (Install, Replace, Demo, etc.)",
          "quantity": "number or null",
          "unit": "string or null",
          "specifications": "string or null",
          "notes": "string or null",
          "source_reference": {
            "sheet": "string (e.g., M0.1)",
            "location": "string (e.g., Equipment Schedule, Row 3)",
            "page": "number (1-indexed page in PDF)",
            "bounding_box": [y_min, x_min, y_max, x_max],
            "text_excerpt": "string (exact text if from specs)"
          },
          "confidence": 0.9,
          "flags": ["string array, e.g., NEEDS_REVIEW, VERIFY_QTY"]
        }
      ]
    }
  ],
  "ai_observations": [
    {
      "severity": "critical | warning | info",
      "category": "risk_flag | coordination_required | warranty_requirement | code_compliance | pricing_concern | scope_gap | missing_information",
      "title": "Brief title",
      "insight": "Detailed explanation of the observation",
      "affected_packages": ["MEC", "ELE"],
      "suggested_actions": ["Action 1", "Action 2"],
      "source_reference": {
        "sheet": "string or null",
        "page": "number or null",
        "bounding_box": [y_min, x_min, y_max, x_max]
      }
    }
  ],
  "extraction_confidence": 0.85,
  "incomplete_areas": ["list of areas you couldn't fully extract"],
  "extraction_notes": "any overall observations about the project"
}
`;
  }

  /**
   * Pass 2: Self-review prompt - Enhanced with AI observations and risk analysis
   */
  private buildPass2Prompt(previousExtraction: string): string {
    return `
You previously extracted the following work packages from these documents:

${previousExtraction}

TASK: Perform a CRITICAL REVIEW of your extraction and provide EXPERT OBSERVATIONS.

## PART 1: FIND MISSED ITEMS

Consider:
1. Did you miss any trades/scopes visible in the documents?
2. Are quantities complete? Look for:
   - Schedule tables (equipment schedules, fixture schedules)
   - Keynotes and legends
   - Detail callouts
3. Are there items that need splitting into multiple line items?
4. Did you capture all coordination items between trades?

SPECIFIC CHECKS:
- Count equipment items in schedules - do your counts match?
- Check for demolition items - often overlooked
- Look for "N.I.C." or "By Others" notes
- Check general notes for hidden requirements
- Look for accessories, supports, and appurtenances
- Check for testing, balancing, and commissioning requirements

## PART 2: EXPERT OBSERVATIONS (CRITICAL)

As a senior estimator, provide your PROFESSIONAL OBSERVATIONS about this project:

A. **RISKS & CONCERNS** - Things that could cause problems:
   - Scope gaps or ambiguities
   - Missing specifications
   - Unusual requirements
   - Potential change order triggers
   - Schedule constraints

B. **COORDINATION REQUIREMENTS** - Items needing multi-trade coordination:
   - MEP coordination points
   - Structural dependencies
   - Sequencing requirements
   - Access or staging needs

C. **PRICING CONCERNS** - Things that affect accurate pricing:
   - Quantities that need verification
   - Items with insufficient detail
   - Market volatility items
   - Long-lead items

D. **CODE & COMPLIANCE** - Regulatory considerations:
   - Code requirements mentioned
   - Inspection points
   - Permit requirements
   - Special certifications needed

E. **WARRANTY & CLOSEOUT** - Requirements that affect project completion:
   - Warranty periods mentioned
   - O&M manual requirements
   - Testing and commissioning
   - Training requirements

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "additions": [
    {
      "work_package": "which package to add to (e.g., MEC)",
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
        "page": "number or null",
        "bounding_box": [y_min, x_min, y_max, x_max]
      },
      "confidence": 0.85,
      "reason_missed": "why this was missed initially"
    }
  ],
  "modifications": [
    {
      "original_item_ref": "package.item_number or description to identify",
      "changes": {
        "field_name": "new_value"
      },
      "reason": "why this change"
    }
  ],
  "new_packages": [
    {
      "packageId": "string",
      "name": "string",
      "csi_division": "string",
      "trade": "string",
      "confidence": { "overall": 0.8, "reasoning": "string" },
      "line_items": []
    }
  ],
  "gaps_identified": ["list of things still unclear or needing verification"],
  "confidence_adjustments": [
    {
      "item_ref": "package.item identifier",
      "previous_confidence": 0.9,
      "new_confidence": 0.7,
      "reason": "string"
    }
  ],
  "ai_observations": [
    {
      "id": "obs_001",
      "severity": "critical | warning | info",
      "category": "risk_flag | coordination_required | warranty_requirement | code_compliance | pricing_concern | scope_gap | missing_information | long_lead_item | change_order_risk",
      "title": "Brief descriptive title",
      "insight": "Detailed explanation of what you observed and why it matters",
      "affected_packages": ["MEC", "ELE"],
      "affected_line_items": ["RTU-1", "Panel D"],
      "source_reference": {
        "sheet": "string or null",
        "location": "string or null",
        "page": "number or null",
        "bounding_box": [y_min, x_min, y_max, x_max],
        "text_excerpt": "relevant quoted text if applicable"
      },
      "suggested_actions": [
        "Clarify with engineer",
        "Request pricing from subcontractor"
      ],
      "estimated_impact": "Cost/schedule impact if known"
    }
  ],
  "overall_assessment": {
    "extraction_completeness": 0.90,
    "data_quality": 0.85,
    "risk_level": "low | medium | high",
    "summary": "Brief overall assessment of the extraction quality and project risks"
  }
}
`;
  }

  /**
   * Correlation prompt for multi-document analysis
   */
  private buildCorrelationPrompt(currentPackages: string): string {
    return `
You have the following work packages extracted from the design drawings:

${currentPackages}

TASK: Analyze ALL provided documents (specifications, addenda, bid forms, etc.) to:

A. FIND ADDITIONS - New requirements not captured from drawings:
   - Specification sections that add scope
   - Submittal requirements
   - Testing requirements
   - Warranty requirements
   - General conditions requirements

B. IDENTIFY MODIFICATIONS - Changes to existing items:
   - Addenda that modify scope
   - Specification clarifications
   - Material substitutions (approved alternates)
   - Quantity adjustments

C. FLAG CONFLICTS - Document inconsistencies:
   - Specification vs. drawing conflicts
   - Addendum superseding original requirements
   - Unclear scope boundaries

D. EXTRACT OBSERVATIONS - Important insights:
   - Critical risk flags
   - Warranty requirements
   - Code compliance issues
   - Coordination requirements

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "updated_packages": {
    "project_name": "string",
    "work_packages": [/* full updated work packages array */]
  },
  "additions": [
    {
      "work_package": "package to add to",
      "item": { /* line item */ },
      "source_document": "which document",
      "source_section": "section reference",
      "reasoning": "why this was added"
    }
  ],
  "modifications": [
    {
      "original_item_ref": "identifier",
      "modification_type": "scope_change | material_change | quantity_change | clarification",
      "previous_value": "what it was",
      "new_value": "what it is now",
      "source_document": "which document",
      "source_section": "section reference",
      "reasoning": "why this changed"
    }
  ],
  "observations": [
    {
      "severity": "critical | warning | info",
      "category": "scope_conflict | warranty_requirement | code_compliance | risk_flag | coordination_required | addendum_impact",
      "title": "brief title",
      "insight": "detailed explanation",
      "affected_packages": ["package IDs"],
      "source_references": ["document references"],
      "suggested_actions": ["what to do"]
    }
  ]
}
`;
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
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    const parts: Part[] = [];

    for (const doc of documents) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    parts.push({
      text: this.buildPass3Prompt(JSON.stringify(currentExtraction, null, 2), focusTrades),
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<GeminiReviewResponse>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Pass 4: Cross-Model Validation
   */
  async crossValidation(
    documents: ExtractionDocument[],
    extraction: GeminiExtractionResponse
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    const parts: Part[] = [];

    for (const doc of documents) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    parts.push({
      text: this.buildPass4Prompt(JSON.stringify(extraction, null, 2)),
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<GeminiReviewResponse>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Pass 5: Final Validation & Quality Check
   */
  async finalValidation(
    documents: ExtractionDocument[],
    extraction: GeminiExtractionResponse,
    previousObservations: string
  ): Promise<{
    response: GeminiReviewResponse;
    tokensUsed: { input: number; output: number };
  }> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    const parts: Part[] = [];

    for (const doc of documents) {
      try {
        const docPart = await this.loadDocument(doc);
        parts.push(docPart);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
      }
    }

    parts.push({
      text: this.buildPass5Prompt(JSON.stringify(extraction, null, 2), previousObservations),
    });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<GeminiReviewResponse>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Pass 3: Trade Deep-Dive prompt
   */
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
  "confidence_adjustments": [],
  "ai_observations": [],
  "overall_assessment": {
    "extraction_completeness": 0.0,
    "data_quality": 0.0,
    "risk_level": "string",
    "summary": "string"
  }
}`;
  }

  /**
   * Pass 4: Cross-Model Validation prompt
   */
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

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "additions": [],
  "modifications": [],
  "new_packages": [],
  "gaps_identified": [],
  "confidence_adjustments": [],
  "ai_observations": [],
  "overall_assessment": {
    "extraction_completeness": 0.0,
    "data_quality": 0.0,
    "risk_level": "string",
    "summary": "string"
  }
}`;
  }

  /**
   * Pass 5: Final Validation prompt
   */
  private buildPass5Prompt(extraction: string, previousObservations: string): string {
    return `FINAL VALIDATION & QUALITY CHECK

Extraction to validate:
${extraction}

Previous observations from earlier passes:
${previousObservations}

YOUR TASK: Final quality check before human review.

## FINAL CHECKS:

1. **OVERALL COMPLETENESS** - Compare against all sheets
2. **DATA QUALITY** - All items have source references?
3. **RISK SUMMARY** - Consolidate all identified risks
4. **HUMAN REVIEW PRIORITIES** - Which items MUST be reviewed?
5. **FINAL CONFIDENCE ASSESSMENT** - Overall quality score

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "additions": [],
  "modifications": [],
  "new_packages": [],
  "gaps_identified": [],
  "confidence_adjustments": [],
  "ai_observations": [],
  "overall_assessment": {
    "extraction_completeness": 0.0,
    "data_quality": 0.0,
    "risk_level": "string",
    "summary": "string"
  }
}`;
  }

  /**
   * Extract from page images (for large document batch processing)
   * Accepts pre-processed page images instead of full documents
   */
  async extractFromPages(
    pageImages: Array<{
      buffer: Buffer;
      mimeType: string;
      pageNumber: number;
    }>,
    context: {
      trade: string;
      csiDivisions: string[];
      pageContext: Array<{
        pageNumber: number;
        sheetNumber?: string;
        textPreview: string;
      }>;
    }
  ): Promise<{
    response: GeminiExtractionResponse & { ai_observations?: unknown[] };
    tokensUsed: { input: number; output: number };
  }> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    // Build parts array with page images
    const parts: Part[] = [];

    for (const page of pageImages) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.buffer.toString('base64'),
        },
      });
    }

    // Build context-aware prompt
    const prompt = this.buildPageExtractionPrompt(context);
    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    const parsed = this.parseJsonResponse<GeminiExtractionResponse & { ai_observations?: unknown[] }>(text);

    const usage = response.usageMetadata;
    const tokensUsed = {
      input: usage?.promptTokenCount || 0,
      output: usage?.candidatesTokenCount || 0,
    };

    return { response: parsed, tokensUsed };
  }

  /**
   * Build prompt for page-based extraction
   */
  private buildPageExtractionPrompt(context: {
    trade: string;
    csiDivisions: string[];
    pageContext: Array<{
      pageNumber: number;
      sheetNumber?: string;
      textPreview: string;
    }>;
  }): string {
    const pageInfo = context.pageContext
      .map((p) => `- Page ${p.pageNumber}${p.sheetNumber ? ` (${p.sheetNumber})` : ''}: ${p.textPreview.substring(0, 100)}...`)
      .join('\n');

    return `
You are a senior preconstruction estimator analyzing construction document pages.

CONTEXT:
- Primary Trade Focus: ${context.trade}
- Related CSI Divisions: ${context.csiDivisions.join(', ')}
- Pages being analyzed:
${pageInfo}

TASK: Extract all work packages and line items relevant to ${context.trade} from these pages.

For each work package found, identify:
1. Trade/CSI Division (use MasterFormat classification)
2. Individual line items with:
   - Item description
   - Action (Install, Replace, Demo, Repair, etc.)
   - Quantity (if visible)
   - Unit of measure (SF, LF, EA, CY, etc.)
   - Specifications/notes
   - Page reference (which page the item was found on)
   - Confidence level

3. **AI OBSERVATIONS** - Expert insights about:
   - Potential risks or concerns
   - Missing information
   - Coordination requirements
   - Code compliance considerations

IMPORTANT:
- Focus on ${context.trade} but capture any related items you see
- Note quantities exactly as shown
- Include equipment schedules, fixture schedules, and keynotes
- Flag anything unclear with "NEEDS_REVIEW"

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "project_name": "string or null",
  "work_packages": [
    {
      "packageId": "string",
      "name": "string",
      "csi_division": "string",
      "trade": "string",
      "description": "string",
      "scope_responsible": "string or null",
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "action": "string",
          "quantity": "number or null",
          "unit": "string or null",
          "specifications": "string or null",
          "notes": "string or null",
          "source_page": "number (page number)",
          "confidence": 0.9,
          "flags": ["NEEDS_REVIEW"]
        }
      ]
    }
  ],
  "ai_observations": [
    {
      "severity": "critical | warning | info",
      "category": "risk_flag | coordination_required | missing_information",
      "title": "string",
      "insight": "string",
      "affected_packages": ["packageId"],
      "suggested_actions": ["string"]
    }
  ]
}
`;
  }
}

// Export singleton instance
let geminiClientInstance: GeminiClient | null = null;

export function getGeminiClient(config?: GeminiClientConfig): GeminiClient {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient(config);
  }
  return geminiClientInstance;
}
