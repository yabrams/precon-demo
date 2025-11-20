/**
 * Public-facing CSI MasterFormat Type Definitions
 *
 * These types are exported for use in components and external modules.
 */

// Re-export core types from internal module
export type {
  CSICode,
  CSIDivision,
  CSILevel,
  CSISearchResult,
  CSISearchOptions,
  CSICategoryOptions,
  CSIMappingMatch,
  CSIMappingResult,
  CSIValidationResult,
  CSIDatasetStats,
} from '@/lib/csi/csiTypes';

/**
 * Request payload for CSI search API
 */
export interface CSISearchRequest {
  /** Search query string */
  query: string;

  /** Optional division filter */
  division?: string;

  /** Optional level filter */
  levels?: (1 | 2 | 3 | 4)[];

  /** Maximum results to return (default: 20) */
  limit?: number;
}

/**
 * Response from CSI search API
 */
export interface CSISearchResponse {
  /** Search results */
  results: Array<{
    code: string;
    title: string;
    level: 1 | 2 | 3 | 4;
    division: string;
    breadcrumb: string[];
    score: number;
  }>;

  /** Total number of matches found */
  totalMatches: number;

  /** Query that was executed */
  query: string;
}

/**
 * Request payload for CSI categories API
 */
export interface CSICategoryRequest {
  /** Filter by division (optional) */
  division?: string;

  /** Maximum depth to return */
  maxDepth?: 1 | 2 | 3 | 4;
}

/**
 * Response from CSI categories API
 */
export interface CSICategoryResponse {
  /** Hierarchical category tree */
  categories: Array<{
    code: string;
    title: string;
    level: 1 | 2 | 3 | 4;
    children?: any[];
  }>;

  /** Division filter applied (if any) */
  division?: string;
}

/**
 * Request payload for CSI mapping API
 */
export interface CSIMappingRequest {
  /** Item description to map */
  itemDescription: string;

  /** Optional quantity context */
  quantity?: number;

  /** Optional unit context */
  unit?: string;

  /** Optional additional notes */
  notes?: string;

  /** Maximum number of matches to return (default: 5) */
  maxMatches?: number;
}

/**
 * Response from CSI mapping API
 */
export interface CSIMappingResponse {
  /** Original item description */
  itemDescription: string;

  /** Matched CSI codes with confidence scores */
  matches: Array<{
    code: string;
    title: string;
    level: 1 | 2 | 3 | 4;
    division: string;
    breadcrumb: string[];
    confidence: number;
    reasoning: string;
  }>;

  /** Overall confidence level */
  overallConfidence: 'high' | 'medium' | 'low';

  /** Number of matches returned */
  matchCount: number;
}
