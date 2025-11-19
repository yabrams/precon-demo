/**
 * CSI MasterFormat 2018 Type Definitions
 *
 * Internal types for CSI MasterFormat data structures and operations.
 */

/**
 * CSI MasterFormat hierarchy levels
 * - Level 1: Division (e.g., "03 - Concrete")
 * - Level 2: Section (e.g., "03 30 00 - Cast-in-Place Concrete")
 * - Level 3: Subsection (e.g., "03 30 53 - Miscellaneous Cast-in-Place Concrete")
 * - Level 4: Detail (e.g., "03 30 53.13 - Concrete Topping")
 */
export type CSILevel = 1 | 2 | 3 | 4;

/**
 * Base CSI code structure
 */
export interface CSICode {
  /** Unique code identifier (e.g., "03 30 53.13") */
  code: string;

  /** Human-readable title */
  title: string;

  /** Hierarchy level (1-4) */
  level: CSILevel;

  /** Parent code (null for top-level divisions) */
  parentCode: string | null;

  /** Division number (e.g., "03" for Concrete) */
  division: string;

  /** Optional description or notes */
  description?: string;

  /** Child codes (for hierarchical navigation) */
  children?: CSICode[];
}

/**
 * Top-level division (Level 1)
 */
export interface CSIDivision extends CSICode {
  level: 1;
  parentCode: null;
}

/**
 * Search result with relevance scoring
 */
export interface CSISearchResult {
  /** Matching CSI code */
  code: CSICode;

  /** Relevance score (0-1, higher is better) */
  score: number;

  /** Fields that matched the search query */
  matchedFields: ('code' | 'title' | 'description')[];

  /** Full path from division to this code */
  breadcrumb: string[];
}

/**
 * Search options
 */
export interface CSISearchOptions {
  /** Search query */
  query: string;

  /** Filter by division(s) */
  divisions?: string[];

  /** Filter by level(s) */
  levels?: CSILevel[];

  /** Maximum number of results */
  limit?: number;

  /** Case-sensitive search */
  caseSensitive?: boolean;

  /** Exact match vs fuzzy search */
  exactMatch?: boolean;

  /** Use fuzzy search with Fuse.js (default: false) */
  fuzzySearch?: boolean;
}

/**
 * Category tree options
 */
export interface CSICategoryOptions {
  /** Filter by specific division */
  division?: string;

  /** Maximum depth to return (default: all levels) */
  maxDepth?: CSILevel;

  /** Include only codes with no children */
  leafNodesOnly?: boolean;
}

/**
 * AI mapping result for a single CSI code match
 */
export interface CSIMappingMatch {
  /** Matched CSI code */
  code: CSICode;

  /** Confidence score (0-1, higher is more confident) */
  confidence: number;

  /** Explanation of why this code was matched */
  reasoning: string;

  /** Full breadcrumb path */
  breadcrumb: string[];
}

/**
 * AI mapping response
 */
export interface CSIMappingResult {
  /** Original item description that was mapped */
  itemDescription: string;

  /** Matched CSI codes ranked by confidence */
  matches: CSIMappingMatch[];

  /** Overall mapping confidence (average of top 3 matches) */
  overallConfidence: 'high' | 'medium' | 'low';

  /** Number of matches found */
  matchCount: number;
}

/**
 * Validation result for CSI codes
 */
export interface CSIValidationResult {
  /** Whether the code is valid */
  isValid: boolean;

  /** Error message if invalid */
  error?: string;

  /** Suggested corrections if applicable */
  suggestions?: string[];
}

/**
 * Statistics about the CSI dataset
 */
export interface CSIDatasetStats {
  /** Total number of codes */
  totalCodes: number;

  /** Count by level */
  countByLevel: Record<CSILevel, number>;

  /** Count by division */
  countByDivision: Record<string, number>;

  /** Dataset version */
  version: string;
}
