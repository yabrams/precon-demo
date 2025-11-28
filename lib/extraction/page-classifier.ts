/**
 * Page Classifier for Large Document Support
 *
 * Classifies construction document pages by CSI division and trade
 * using sheet number patterns and content analysis.
 */

import { PageType, PDFPageMetadata, ProcessedPage } from '../pdf-utils';

// ============================================================================
// CSI/TRADE MAPPING
// ============================================================================

/**
 * Mapping of sheet prefixes to CSI divisions and trades
 * Based on common AIA (American Institute of Architects) conventions
 */
export const SHEET_PREFIX_MAP: Record<
  string,
  { csiDivision: string; trade: string; description: string }
> = {
  // General
  G: { csiDivision: '01', trade: 'General', description: 'General Requirements' },
  T: { csiDivision: '01', trade: 'General', description: 'Title/Cover Sheets' },

  // Site/Civil
  C: { csiDivision: '31', trade: 'Civil', description: 'Earthwork/Site' },
  L: { csiDivision: '32', trade: 'Landscape', description: 'Exterior Improvements' },

  // Architectural
  A: { csiDivision: '06', trade: 'Architectural', description: 'Wood/Plastics/Composites' },
  AD: { csiDivision: '08', trade: 'Architectural', description: 'Openings/Doors' },
  I: { csiDivision: '12', trade: 'Interiors', description: 'Furnishings' },
  ID: { csiDivision: '12', trade: 'Interiors', description: 'Interior Design' },

  // Structural
  S: { csiDivision: '03', trade: 'Structural', description: 'Concrete/Structural' },

  // Mechanical
  M: { csiDivision: '23', trade: 'Mechanical', description: 'HVAC' },
  H: { csiDivision: '23', trade: 'Mechanical', description: 'HVAC' },

  // Plumbing
  P: { csiDivision: '22', trade: 'Plumbing', description: 'Plumbing' },

  // Fire Protection
  FP: { csiDivision: '21', trade: 'Fire Protection', description: 'Fire Suppression' },
  FS: { csiDivision: '21', trade: 'Fire Protection', description: 'Fire Suppression' },
  SP: { csiDivision: '21', trade: 'Fire Protection', description: 'Sprinkler' },

  // Electrical
  E: { csiDivision: '26', trade: 'Electrical', description: 'Electrical' },
  EP: { csiDivision: '26', trade: 'Electrical', description: 'Electrical Power' },
  EL: { csiDivision: '26', trade: 'Electrical', description: 'Electrical Lighting' },

  // Low Voltage / Communications
  D: { csiDivision: '27', trade: 'Communications', description: 'Communications' },
  T1: { csiDivision: '27', trade: 'Communications', description: 'Telecom' },

  // Fire Alarm
  FA: { csiDivision: '28', trade: 'Fire Alarm', description: 'Electronic Safety/Security' },

  // Kitchen/Food Service
  K: { csiDivision: '11', trade: 'Food Service', description: 'Equipment' },
  FS2: { csiDivision: '11', trade: 'Food Service', description: 'Food Service Equipment' },

  // Medical/Lab
  ME: { csiDivision: '11', trade: 'Medical Equipment', description: 'Medical Equipment' },
};

/**
 * CSI Division descriptions
 */
export const CSI_DIVISIONS: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics, Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '25': 'Integrated Automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
};

// ============================================================================
// CLASSIFICATION INTERFACES
// ============================================================================

export interface PageClassification {
  pageNumber: number;
  csiDivision: string;
  csiDivisionName: string;
  trade: string;
  pageType: PageType;
  confidence: number;
  sheetNumber?: string;
  method: 'pattern' | 'content' | 'ai' | 'default';
  keywords: string[];
}

export interface ClassifiedDocument {
  totalPages: number;
  classifications: PageClassification[];
  tradeGroups: Map<string, PageClassification[]>;
  csiGroups: Map<string, PageClassification[]>;
  summary: {
    tradesIdentified: string[];
    csiDivisionsIdentified: string[];
    pagesPerTrade: Record<string, number>;
    pagesPerType: Record<string, number>;
  };
}

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Extract trade/CSI info from sheet number prefix
 */
export function classifyBySheetPrefix(sheetNumber: string): {
  csiDivision: string;
  trade: string;
  confidence: number;
} | null {
  if (!sheetNumber) return null;

  // Try two-character prefixes first (more specific)
  const twoCharPrefix = sheetNumber.substring(0, 2).toUpperCase();
  if (SHEET_PREFIX_MAP[twoCharPrefix]) {
    const { csiDivision, trade } = SHEET_PREFIX_MAP[twoCharPrefix];
    return { csiDivision, trade, confidence: 0.95 };
  }

  // Try single character prefix
  const oneCharPrefix = sheetNumber.charAt(0).toUpperCase();
  if (SHEET_PREFIX_MAP[oneCharPrefix]) {
    const { csiDivision, trade } = SHEET_PREFIX_MAP[oneCharPrefix];
    return { csiDivision, trade, confidence: 0.9 };
  }

  return null;
}

/**
 * Trade-related keywords for content-based classification
 */
const TRADE_KEYWORDS: Record<string, { keywords: string[]; csiDivision: string }> = {
  Mechanical: {
    keywords: [
      'hvac', 'air handling', 'ahu', 'rtu', 'rooftop unit', 'ductwork',
      'diffuser', 'vav', 'fan coil', 'chiller', 'boiler', 'mechanical room',
      'air conditioning', 'heating', 'ventilation', 'exhaust fan', 'supply air',
      'return air', 'refrigerant', 'compressor', 'condenser', 'evaporator',
    ],
    csiDivision: '23',
  },
  Electrical: {
    keywords: [
      'electrical', 'panel', 'circuit', 'breaker', 'transformer', 'switchgear',
      'lighting', 'receptacle', 'outlet', 'conduit', 'wire', 'cable tray',
      'motor control', 'disconnect', 'voltage', 'ampere', 'watt', 'generator',
      'ups', 'emergency power', 'grounding', 'busway',
    ],
    csiDivision: '26',
  },
  Plumbing: {
    keywords: [
      'plumbing', 'water heater', 'fixture', 'lavatory', 'toilet', 'urinal',
      'sink', 'faucet', 'drain', 'sewer', 'sanitary', 'vent', 'water supply',
      'domestic water', 'hot water', 'cold water', 'waste', 'trap', 'valve',
      'backflow', 'water meter', 'grease interceptor',
    ],
    csiDivision: '22',
  },
  'Fire Protection': {
    keywords: [
      'sprinkler', 'fire suppression', 'standpipe', 'fire pump', 'fire alarm',
      'smoke detector', 'fire extinguisher', 'fire department connection', 'fdc',
      'wet system', 'dry system', 'pre-action', 'deluge', 'fire rated',
    ],
    csiDivision: '21',
  },
  Structural: {
    keywords: [
      'structural', 'foundation', 'footing', 'column', 'beam', 'girder',
      'joist', 'truss', 'rebar', 'reinforcement', 'concrete', 'steel',
      'moment frame', 'shear wall', 'bracing', 'pile', 'grade beam',
    ],
    csiDivision: '03',
  },
  Architectural: {
    keywords: [
      'floor plan', 'reflected ceiling', 'elevation', 'section', 'detail',
      'door schedule', 'window schedule', 'finish schedule', 'partition',
      'ceiling', 'millwork', 'casework', 'countertop', 'tile', 'carpet',
    ],
    csiDivision: '06',
  },
  Civil: {
    keywords: [
      'site plan', 'grading', 'drainage', 'storm', 'sanitary sewer',
      'water main', 'curb', 'gutter', 'parking', 'paving', 'asphalt',
      'concrete pavement', 'sidewalk', 'landscape', 'irrigation',
    ],
    csiDivision: '31',
  },
  Communications: {
    keywords: [
      'data', 'network', 'telecom', 'fiber', 'cable', 'rack', 'server',
      'wifi', 'wireless', 'access point', 'security camera', 'cctv',
      'access control', 'intercom', 'paging', 'audio visual', 'av',
    ],
    csiDivision: '27',
  },
};

/**
 * Classify page by analyzing text content for trade-specific keywords
 */
export function classifyByContent(textContent: string): {
  trade: string;
  csiDivision: string;
  confidence: number;
  matchedKeywords: string[];
} | null {
  const lowerContent = textContent.toLowerCase();
  let bestMatch: {
    trade: string;
    csiDivision: string;
    matchCount: number;
    matchedKeywords: string[];
  } | null = null;

  for (const [trade, { keywords, csiDivision }] of Object.entries(TRADE_KEYWORDS)) {
    const matchedKeywords = keywords.filter((kw) => lowerContent.includes(kw));
    const matchCount = matchedKeywords.length;

    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
      bestMatch = { trade, csiDivision, matchCount, matchedKeywords };
    }
  }

  if (bestMatch && bestMatch.matchCount >= 2) {
    // Confidence based on number of keyword matches
    const confidence = Math.min(0.5 + bestMatch.matchCount * 0.1, 0.85);
    return {
      trade: bestMatch.trade,
      csiDivision: bestMatch.csiDivision,
      confidence,
      matchedKeywords: bestMatch.matchedKeywords,
    };
  }

  return null;
}

/**
 * Classify a single page
 */
export function classifyPage(page: PDFPageMetadata | ProcessedPage): PageClassification {
  const { pageNumber, sheetNumber, textContent, estimatedType } = page;

  // Try sheet prefix classification first (most reliable)
  const prefixResult = sheetNumber ? classifyBySheetPrefix(sheetNumber) : null;
  if (prefixResult) {
    return {
      pageNumber,
      csiDivision: prefixResult.csiDivision,
      csiDivisionName: CSI_DIVISIONS[prefixResult.csiDivision] || 'Unknown',
      trade: prefixResult.trade,
      pageType: estimatedType,
      confidence: prefixResult.confidence,
      sheetNumber,
      method: 'pattern',
      keywords: [],
    };
  }

  // Try content-based classification
  const contentResult = classifyByContent(textContent);
  if (contentResult) {
    return {
      pageNumber,
      csiDivision: contentResult.csiDivision,
      csiDivisionName: CSI_DIVISIONS[contentResult.csiDivision] || 'Unknown',
      trade: contentResult.trade,
      pageType: estimatedType,
      confidence: contentResult.confidence,
      sheetNumber,
      method: 'content',
      keywords: contentResult.matchedKeywords,
    };
  }

  // Default classification based on page type
  let defaultTrade = 'General';
  let defaultCsi = '01';

  if (estimatedType === 'specification') {
    defaultTrade = 'Specifications';
    defaultCsi = '01';
  } else if (estimatedType === 'schedule') {
    // Schedules could be any trade - mark as unclassified
    defaultTrade = 'Unclassified';
    defaultCsi = '00';
  }

  return {
    pageNumber,
    csiDivision: defaultCsi,
    csiDivisionName: CSI_DIVISIONS[defaultCsi] || 'Unknown',
    trade: defaultTrade,
    pageType: estimatedType,
    confidence: 0.3,
    sheetNumber,
    method: 'default',
    keywords: [],
  };
}

/**
 * Classify all pages in a document and group by trade/CSI
 */
export function classifyDocument(
  pages: (PDFPageMetadata | ProcessedPage)[]
): ClassifiedDocument {
  const classifications: PageClassification[] = pages.map(classifyPage);

  // Group by trade
  const tradeGroups = new Map<string, PageClassification[]>();
  for (const classification of classifications) {
    const existing = tradeGroups.get(classification.trade) || [];
    existing.push(classification);
    tradeGroups.set(classification.trade, existing);
  }

  // Group by CSI division
  const csiGroups = new Map<string, PageClassification[]>();
  for (const classification of classifications) {
    const existing = csiGroups.get(classification.csiDivision) || [];
    existing.push(classification);
    csiGroups.set(classification.csiDivision, existing);
  }

  // Build summary
  const pagesPerTrade: Record<string, number> = {};
  const pagesPerType: Record<string, number> = {};

  for (const classification of classifications) {
    pagesPerTrade[classification.trade] =
      (pagesPerTrade[classification.trade] || 0) + 1;
    pagesPerType[classification.pageType] =
      (pagesPerType[classification.pageType] || 0) + 1;
  }

  return {
    totalPages: pages.length,
    classifications,
    tradeGroups,
    csiGroups,
    summary: {
      tradesIdentified: Array.from(tradeGroups.keys()).sort(),
      csiDivisionsIdentified: Array.from(csiGroups.keys()).sort(),
      pagesPerTrade,
      pagesPerType,
    },
  };
}

/**
 * Get pages for a specific trade
 */
export function getPagesByTrade(
  classifiedDoc: ClassifiedDocument,
  trade: string
): PageClassification[] {
  return classifiedDoc.tradeGroups.get(trade) || [];
}

/**
 * Get pages for a specific CSI division
 */
export function getPagesByCSI(
  classifiedDoc: ClassifiedDocument,
  csiDivision: string
): PageClassification[] {
  return classifiedDoc.csiGroups.get(csiDivision) || [];
}

/**
 * Get unclassified or low-confidence pages
 */
export function getUnclassifiedPages(
  classifiedDoc: ClassifiedDocument,
  confidenceThreshold = 0.5
): PageClassification[] {
  return classifiedDoc.classifications.filter(
    (c) => c.confidence < confidenceThreshold || c.trade === 'Unclassified'
  );
}

/**
 * Estimate total tokens for a trade group
 */
export function estimateTradeTokens(
  pages: (PDFPageMetadata | ProcessedPage)[],
  tradeClassifications: PageClassification[]
): number {
  let totalTokens = 0;

  for (const classification of tradeClassifications) {
    const page = pages.find((p) => p.pageNumber === classification.pageNumber);
    if (page) {
      totalTokens += page.estimatedTokens;
    }
  }

  return totalTokens;
}
