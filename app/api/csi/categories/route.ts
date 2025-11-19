import { NextResponse } from 'next/server';
import { getCategoryTree } from '@/lib/csi/csiLookup';
import { CSICategoryRequest, CSICategoryResponse } from '@/types/csi';

/**
 * GET /api/csi/categories?division=03&maxDepth=2
 *
 * Get hierarchical CSI MasterFormat category tree
 *
 * Query parameters:
 * - division (optional): Filter by specific division (e.g., "03")
 * - maxDepth (optional): Maximum depth to return (1-4)
 *
 * Response:
 * {
 *   "categories": [
 *     {
 *       "code": "03",
 *       "title": "Concrete",
 *       "level": 1,
 *       "children": [
 *         {
 *           "code": "03 10 00",
 *           "title": "Concrete Forming and Accessories",
 *           "level": 2,
 *           "children": [...]
 *         }
 *       ]
 *     }
 *   ],
 *   "division": "03"
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division') || undefined;
    const maxDepthParam = searchParams.get('maxDepth');
    const maxDepth = maxDepthParam ? parseInt(maxDepthParam, 10) : undefined;

    // Validate maxDepth
    if (maxDepth !== undefined && (maxDepth < 1 || maxDepth > 4)) {
      return NextResponse.json(
        { error: 'maxDepth must be between 1 and 4' },
        { status: 400 }
      );
    }

    // Get category tree
    const categories = getCategoryTree({
      division,
      maxDepth: maxDepth as 1 | 2 | 3 | 4 | undefined,
      leafNodesOnly: false,
    });

    // Format response
    const response: CSICategoryResponse = {
      categories: categories.map((cat) => ({
        code: cat.code,
        title: cat.title,
        level: cat.level,
        children: cat.children?.map((child) => formatCategory(child)),
      })),
      division,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('CSI categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CSI categories' },
      { status: 500 }
    );
  }
}

/**
 * Recursively format category tree
 */
function formatCategory(category: any): any {
  return {
    code: category.code,
    title: category.title,
    level: category.level,
    children: category.children?.map((child: any) => formatCategory(child)),
  };
}

export const runtime = 'nodejs';
