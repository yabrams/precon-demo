/**
 * CSI MasterFormat AI Mapping Service
 *
 * Uses Claude AI to intelligently map construction line item descriptions
 * to appropriate CSI MasterFormat codes with confidence scores.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAllCSICodes, getBreadcrumb } from './csiLookup';
import { CSIMappingResult, CSIMappingMatch, CSICode } from './csiTypes';

/**
 * Map a line item description to CSI codes using AI
 */
export async function mapItemToCSI(
  itemDescription: string,
  context?: {
    quantity?: number;
    unit?: string;
    notes?: string;
  },
  maxMatches: number = 5
): Promise<CSIMappingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const client = new Anthropic({ apiKey });

  // Get all CSI codes for reference
  const allCodes = getAllCSICodes();

  // Build context string
  let contextStr = `Item Description: ${itemDescription}`;
  if (context?.quantity && context?.unit) {
    contextStr += `\nQuantity: ${context.quantity} ${context.unit}`;
  }
  if (context?.notes) {
    contextStr += `\nNotes: ${context.notes}`;
  }

  // Create a condensed reference of CSI codes for the AI
  // Include all codes but in a compact format
  const csiReference = allCodes.map((code) => ({
    code: code.code,
    title: code.title,
    level: code.level,
    division: code.division,
  }));

  const prompt = `You are an expert in construction specifications and CSI MasterFormat 2018.

Given a construction line item description, identify the most appropriate CSI MasterFormat codes that match this item.

LINE ITEM:
${contextStr}

CSI MASTERFORMAT 2018 REFERENCE:
${JSON.stringify(csiReference.slice(0, 500), null, 2)}
... (full dataset available - ${csiReference.length} total codes)

INSTRUCTIONS:
1. Analyze the line item description and context
2. Identify ${maxMatches} most appropriate CSI codes that match this item
3. For each match, provide:
   - The exact CSI code (must exist in the reference data)
   - Confidence score (0.0 to 1.0, where 1.0 is perfect match)
   - Brief reasoning explaining why this code matches
4. Rank matches by confidence (highest first)
5. Consider:
   - Material types (concrete, steel, wood, etc.)
   - Work type (forming, reinforcing, finishing, etc.)
   - Specificity level (prefer more specific Level 3-4 codes when applicable)
   - Common construction terminology and synonyms

Return ONLY a JSON object with this exact structure:
{
  "matches": [
    {
      "code": "03 31 13",
      "confidence": 0.95,
      "reasoning": "Brief explanation of why this code matches"
    }
  ]
}

IMPORTANT:
- Only return codes that exist in CSI MasterFormat 2018
- Confidence should reflect how certain you are about the match
- High confidence (0.8-1.0): Very clear match
- Medium confidence (0.5-0.79): Reasonable match but some ambiguity
- Low confidence (0.0-0.49): Possible match but uncertain
- Return exactly ${maxMatches} matches unless fewer are truly applicable
`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let parsed: { matches: Array<{ code: string; confidence: number; reasoning: string }> };

    try {
      if (responseText.includes('```json')) {
        const jsonStart = responseText.indexOf('```json') + 7;
        const jsonEnd = responseText.indexOf('```', jsonStart);
        const jsonStr = responseText.substring(jsonStart, jsonEnd).trim();
        parsed = JSON.parse(jsonStr);
      } else if (responseText.includes('{')) {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        const jsonStr = responseText.substring(jsonStart, jsonEnd);
        parsed = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Response text:', responseText);

      // Return empty result if parsing fails
      return {
        itemDescription,
        matches: [],
        overallConfidence: 'low',
        matchCount: 0,
      };
    }

    // Validate and enrich matches
    const matches: CSIMappingMatch[] = [];

    for (const match of parsed.matches) {
      // Find the full code object
      const fullCode = allCodes.find((c) => c.code === match.code);

      if (fullCode) {
        matches.push({
          code: fullCode,
          confidence: match.confidence,
          reasoning: match.reasoning,
          breadcrumb: getBreadcrumb(fullCode.code),
        });
      } else {
        console.warn(`AI returned invalid CSI code: ${match.code}`);
      }
    }

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(matches);

    return {
      itemDescription,
      matches,
      overallConfidence,
      matchCount: matches.length,
    };
  } catch (error) {
    console.error('CSI mapping error:', error);
    throw error;
  }
}

/**
 * Calculate overall confidence level based on top matches
 */
function calculateOverallConfidence(
  matches: CSIMappingMatch[]
): 'high' | 'medium' | 'low' {
  if (matches.length === 0) {
    return 'low';
  }

  // Average confidence of top 3 matches (or all if fewer than 3)
  const topMatches = matches.slice(0, 3);
  const avgConfidence =
    topMatches.reduce((sum, match) => sum + match.confidence, 0) / topMatches.length;

  if (avgConfidence >= 0.8) {
    return 'high';
  } else if (avgConfidence >= 0.5) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Batch map multiple items to CSI codes
 */
export async function batchMapItemsToCSI(
  items: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }>,
  maxMatchesPerItem: number = 3
): Promise<CSIMappingResult[]> {
  const results: CSIMappingResult[] = [];

  // Process items sequentially to avoid rate limiting
  for (const item of items) {
    try {
      const result = await mapItemToCSI(
        item.description,
        {
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        },
        maxMatchesPerItem
      );
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to map item: ${item.description}`, error);
      // Add empty result for failed items
      results.push({
        itemDescription: item.description,
        matches: [],
        overallConfidence: 'low',
        matchCount: 0,
      });
    }
  }

  return results;
}

/**
 * Get CSI code suggestions based on partial input
 * This is a simpler, non-AI version for autocomplete scenarios
 */
export function getSuggestions(partialInput: string, limit: number = 10): CSICode[] {
  if (!partialInput || partialInput.length < 2) {
    return [];
  }

  const allCodes = getAllCSICodes();
  const normalized = partialInput.toLowerCase();

  // Simple fuzzy match
  const matches = allCodes
    .filter(
      (code) =>
        code.code.toLowerCase().includes(normalized) ||
        code.title.toLowerCase().includes(normalized)
    )
    .slice(0, limit);

  return matches;
}
