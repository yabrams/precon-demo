/**
 * Client-Side CSI MasterFormat Module
 *
 * This module provides browser-compatible CSI search and navigation functions.
 * The data is bundled with the client for instant, offline-capable operations.
 *
 * Key differences from server-side module:
 * - Data is imported directly (bundled with client code)
 * - All operations are synchronous
 * - No API calls required
 * - Works offline
 * - Includes fuzzy search using Fuse.js
 */

import Fuse from 'fuse.js';
import masterformatData from './masterformatData.json';
import {
  CSICode,
  CSIDivision,
  CSILevel,
  CSISearchResult,
  CSISearchOptions,
  CSICategoryOptions,
} from './csiTypes';

/**
 * Flatten nested CSI hierarchy into a flat array of all codes
 */
function flattenCSIHierarchy(divisions: CSICode[]): CSICode[] {
  const flattened: CSICode[] = [];

  function traverse(codes: CSICode[]) {
    codes.forEach((code) => {
      flattened.push(code);
      if (code.children && code.children.length > 0) {
        traverse(code.children);
      }
    });
  }

  traverse(divisions);
  return flattened;
}

// Cache flattened data for performance
let cachedFlatCodes: CSICode[] | null = null;

/**
 * Get all CSI codes as a flat array (cached)
 */
export function getAllCSICodes(): CSICode[] {
  if (!cachedFlatCodes) {
    cachedFlatCodes = flattenCSIHierarchy(masterformatData.divisions as CSICode[]);
  }
  return cachedFlatCodes;
}

// Cache Fuse instance for performance
let cachedFuse: Fuse<CSICode> | null = null;

/**
 * Get Fuse.js instance for fuzzy searching (cached)
 */
function getFuseInstance(): Fuse<CSICode> {
  if (!cachedFuse) {
    const allCodes = getAllCSICodes();
    cachedFuse = new Fuse(allCodes, {
      keys: [
        { name: 'code', weight: 2 },
        { name: 'title', weight: 3 },
        { name: 'description', weight: 1 },
      ],
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
    });
  }
  return cachedFuse;
}

/**
 * Get all divisions (Level 1 codes)
 */
export function getDivisions(): CSIDivision[] {
  return (masterformatData.divisions as CSICode[]) as CSIDivision[];
}

/**
 * Get a specific code by its code string
 */
export function getCodeByCode(codeString: string): CSICode | null {
  const allCodes = getAllCSICodes();
  return allCodes.find((code) => code.code === codeString) || null;
}

/**
 * Get the full breadcrumb path for a code
 */
export function getBreadcrumb(codeString: string): string[] {
  const code = getCodeByCode(codeString);
  if (!code) return [];

  const breadcrumb: string[] = [];
  let current: CSICode | null = code;

  while (current) {
    breadcrumb.unshift(`${current.code} - ${current.title}`);
    if (current.parentCode) {
      current = getCodeByCode(current.parentCode);
    } else {
      current = null;
    }
  }

  return breadcrumb;
}

/**
 * Calculate relevance score for search match
 */
function calculateRelevanceScore(code: CSICode, query: string, caseSensitive: boolean): number {
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();
  const codeStr = caseSensitive ? code.code : code.code.toLowerCase();
  const titleStr = caseSensitive ? code.title : code.title.toLowerCase();
  const descStr = caseSensitive ? (code.description || '') : (code.description || '').toLowerCase();

  let score = 0;

  // Exact code match = highest priority
  if (codeStr === normalizedQuery) {
    score += 100;
  } else if (codeStr.startsWith(normalizedQuery)) {
    score += 80;
  } else if (codeStr.includes(normalizedQuery)) {
    score += 40;
  }

  // Title exact match
  if (titleStr === normalizedQuery) {
    score += 90;
  } else if (titleStr.startsWith(normalizedQuery)) {
    score += 60;
  } else if (titleStr.includes(normalizedQuery)) {
    score += 30;
  }

  // Description match
  if (descStr.includes(normalizedQuery)) {
    score += 20;
  }

  // Boost for higher-level codes (divisions are more general)
  if (code.level === 1) score += 5;
  else if (code.level === 2) score += 3;

  return score;
}

/**
 * Search CSI codes (client-side)
 */
export function searchCSICodes(options: CSISearchOptions): CSISearchResult[] {
  const {
    query,
    divisions = [],
    levels = [],
    limit = 20,
    caseSensitive = false,
    exactMatch = false,
    fuzzySearch = false,
  } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Use Fuse.js fuzzy search if enabled
  if (fuzzySearch) {
    return searchCSICodesFuzzy(options);
  }

  const allCodes = getAllCSICodes();
  const results: CSISearchResult[] = [];

  const normalizedQuery = caseSensitive ? query.trim() : query.trim().toLowerCase();

  allCodes.forEach((code) => {
    // Apply division filter
    if (divisions.length > 0 && !divisions.includes(code.division)) {
      return;
    }

    // Apply level filter
    if (levels.length > 0 && !levels.includes(code.level)) {
      return;
    }

    const codeStr = caseSensitive ? code.code : code.code.toLowerCase();
    const titleStr = caseSensitive ? code.title : code.title.toLowerCase();
    const descStr = caseSensitive ? (code.description || '') : (code.description || '').toLowerCase();

    let matches = false;
    const matchedFields: ('code' | 'title' | 'description')[] = [];

    if (exactMatch) {
      // Exact match mode
      if (codeStr === normalizedQuery) {
        matches = true;
        matchedFields.push('code');
      }
      if (titleStr === normalizedQuery) {
        matches = true;
        matchedFields.push('title');
      }
      if (descStr === normalizedQuery) {
        matches = true;
        matchedFields.push('description');
      }
    } else {
      // Fuzzy match mode
      if (codeStr.includes(normalizedQuery)) {
        matches = true;
        matchedFields.push('code');
      }
      if (titleStr.includes(normalizedQuery)) {
        matches = true;
        matchedFields.push('title');
      }
      if (descStr.includes(normalizedQuery)) {
        matches = true;
        matchedFields.push('description');
      }
    }

    if (matches) {
      const score = calculateRelevanceScore(code, query, caseSensitive);
      const breadcrumb = getBreadcrumb(code.code);

      results.push({
        code,
        score,
        matchedFields,
        breadcrumb,
      });
    }
  });

  // Sort by relevance score (descending)
  results.sort((a, b) => b.score - a.score);

  // Apply limit
  return results.slice(0, limit);
}

/**
 * Search CSI codes using Fuse.js fuzzy search
 */
function searchCSICodesFuzzy(options: CSISearchOptions): CSISearchResult[] {
  const {
    query,
    divisions = [],
    levels = [],
    limit = 20,
  } = options;

  const fuse = getFuseInstance();
  const fuseResults = fuse.search(query.trim());

  const results: CSISearchResult[] = [];

  for (const fuseResult of fuseResults) {
    const code = fuseResult.item;

    // Apply division filter
    if (divisions.length > 0 && !divisions.includes(code.division)) {
      continue;
    }

    // Apply level filter
    if (levels.length > 0 && !levels.includes(code.level)) {
      continue;
    }

    // Determine matched fields from Fuse.js matches
    const matchedFields: ('code' | 'title' | 'description')[] = [];
    if (fuseResult.matches) {
      for (const match of fuseResult.matches) {
        const key = match.key as 'code' | 'title' | 'description';
        if (!matchedFields.includes(key)) {
          matchedFields.push(key);
        }
      }
    }

    // Convert Fuse.js score (lower is better) to our score (higher is better)
    // Fuse score is 0-1 where 0 is perfect match
    const score = fuseResult.score !== undefined ? (1 - fuseResult.score) * 100 : 0;

    const breadcrumb = getBreadcrumb(code.code);

    results.push({
      code,
      score,
      matchedFields,
      breadcrumb,
    });

    // Apply limit during iteration for performance
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

/**
 * Get category tree (hierarchical structure)
 */
export function getCategoryTree(options: CSICategoryOptions = {}): CSICode[] {
  const { division, maxDepth, leafNodesOnly = false } = options;

  let tree: CSICode[] = masterformatData.divisions as CSICode[];

  // Filter by division
  if (division) {
    tree = tree.filter((div) => div.code === division);
  }

  // Apply depth limit
  if (maxDepth !== undefined) {
    tree = limitDepth(tree, maxDepth);
  }

  // Filter for leaf nodes only
  if (leafNodesOnly) {
    return getLeafNodes(tree);
  }

  return tree;
}

/**
 * Limit tree depth
 */
function limitDepth(codes: CSICode[], maxLevel: CSILevel): CSICode[] {
  return codes.map((code) => {
    if (code.level >= maxLevel) {
      // At or beyond max depth - remove children
      return { ...code, children: [] };
    } else if (code.children && code.children.length > 0) {
      // Recurse into children
      return { ...code, children: limitDepth(code.children, maxLevel) };
    } else {
      return code;
    }
  });
}

/**
 * Get only leaf nodes (codes with no children)
 */
function getLeafNodes(codes: CSICode[]): CSICode[] {
  const leaves: CSICode[] = [];

  function traverse(nodes: CSICode[]) {
    nodes.forEach((node) => {
      if (!node.children || node.children.length === 0) {
        leaves.push(node);
      } else {
        traverse(node.children);
      }
    });
  }

  traverse(codes);
  return leaves;
}

/**
 * Get children of a specific code
 */
export function getChildren(codeString: string): CSICode[] {
  const code = getCodeByCode(codeString);
  return code?.children || [];
}

/**
 * Get parent of a specific code
 */
export function getParent(codeString: string): CSICode | null {
  const code = getCodeByCode(codeString);
  if (!code || !code.parentCode) return null;
  return getCodeByCode(code.parentCode);
}

/**
 * Get dataset statistics
 */
export function getDatasetStats() {
  const allCodes = getAllCSICodes();

  const countByLevel: Record<CSILevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const countByDivision: Record<string, number> = {};

  allCodes.forEach((code) => {
    countByLevel[code.level]++;

    if (!countByDivision[code.division]) {
      countByDivision[code.division] = 0;
    }
    countByDivision[code.division]++;
  });

  return {
    totalCodes: allCodes.length,
    countByLevel,
    countByDivision,
    version: masterformatData.version,
  };
}

/**
 * Filter codes by division
 */
export function getCodesByDivision(division: string): CSICode[] {
  const allCodes = getAllCSICodes();
  return allCodes.filter((code) => code.division === division);
}

/**
 * Filter codes by level
 */
export function getCodesByLevel(level: CSILevel): CSICode[] {
  const allCodes = getAllCSICodes();
  return allCodes.filter((code) => code.level === level);
}
