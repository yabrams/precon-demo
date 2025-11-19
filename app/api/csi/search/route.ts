import { NextResponse } from 'next/server';
import { searchCSICodes } from '@/lib/csi/csiLookup';
import { CSISearchRequest, CSISearchResponse } from '@/types/csi';

/**
 * POST /api/csi/search
 *
 * Search CSI MasterFormat codes by keyword or code number
 *
 * Request body:
 * {
 *   "query": "concrete",
 *   "division": "03",          // Optional: filter by division
 *   "levels": [3, 4],          // Optional: filter by levels
 *   "limit": 20                // Optional: max results (default: 20)
 * }
 *
 * Response:
 * {
 *   "results": [
 *     {
 *       "code": "03 30 00",
 *       "title": "Cast-in-Place Concrete",
 *       "level": 2,
 *       "division": "03",
 *       "breadcrumb": ["03 - Concrete", "03 30 00 - Cast-in-Place Concrete"],
 *       "score": 85
 *     }
 *   ],
 *   "totalMatches": 15,
 *   "query": "concrete"
 * }
 */
export async function POST(request: Request) {
  try {
    const body: CSISearchRequest = await request.json();
    const { query, division, levels, limit = 20 } = body;

    // Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Prepare search options
    const searchOptions = {
      query: query.trim(),
      divisions: division ? [division] : [],
      levels: levels || [],
      limit: Math.min(limit, 100), // Cap at 100 results
      caseSensitive: false,
      exactMatch: false,
    };

    // Perform search
    const searchResults = searchCSICodes(searchOptions);

    // Format response
    const response: CSISearchResponse = {
      results: searchResults.map((result) => ({
        code: result.code.code,
        title: result.code.title,
        level: result.code.level,
        division: result.code.division,
        breadcrumb: result.breadcrumb,
        score: result.score,
      })),
      totalMatches: searchResults.length,
      query: query.trim(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('CSI search error:', error);
    return NextResponse.json(
      { error: 'Failed to search CSI codes' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
