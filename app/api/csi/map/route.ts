import { NextResponse } from 'next/server';
import { mapItemToCSI } from '@/lib/csi/csiMapper';
import { CSIMappingRequest, CSIMappingResponse } from '@/types/csi';

/**
 * POST /api/csi/map
 *
 * Use AI to map a construction line item to appropriate CSI MasterFormat codes
 *
 * Request body:
 * {
 *   "itemDescription": "Cast-in-place concrete foundation walls",
 *   "quantity": 150,           // Optional
 *   "unit": "CY",              // Optional
 *   "notes": "3000 psi",       // Optional
 *   "maxMatches": 5            // Optional: default 5
 * }
 *
 * Response:
 * {
 *   "itemDescription": "Cast-in-place concrete foundation walls",
 *   "matches": [
 *     {
 *       "code": "03 31 13",
 *       "title": "Heavyweight Structural Concrete",
 *       "level": 4,
 *       "division": "03",
 *       "breadcrumb": ["03 - Concrete", "03 30 00 - Cast-in-Place Concrete", ...],
 *       "confidence": 0.95,
 *       "reasoning": "Foundation walls are structural concrete applications..."
 *     }
 *   ],
 *   "overallConfidence": "high",
 *   "matchCount": 3
 * }
 */
export async function POST(request: Request) {
  try {
    const body: CSIMappingRequest = await request.json();
    const { itemDescription, quantity, unit, notes, maxMatches = 5 } = body;

    // Validate input
    if (!itemDescription || itemDescription.trim().length === 0) {
      return NextResponse.json(
        { error: 'Item description is required' },
        { status: 400 }
      );
    }

    if (maxMatches < 1 || maxMatches > 10) {
      return NextResponse.json(
        { error: 'maxMatches must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI mapping service is not configured' },
        { status: 500 }
      );
    }

    // Perform AI mapping
    const result = await mapItemToCSI(
      itemDescription.trim(),
      {
        quantity,
        unit,
        notes,
      },
      maxMatches
    );

    // Format response
    const response: CSIMappingResponse = {
      itemDescription: result.itemDescription,
      matches: result.matches.map((match) => ({
        code: match.code.code,
        title: match.code.title,
        level: match.code.level,
        division: match.code.division,
        breadcrumb: match.breadcrumb,
        confidence: match.confidence,
        reasoning: match.reasoning,
      })),
      overallConfidence: result.overallConfidence,
      matchCount: result.matchCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('CSI mapping error:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        return NextResponse.json(
          { error: 'AI mapping service is not configured' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to map item to CSI codes' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for AI processing
