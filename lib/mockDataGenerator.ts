/**
 * Mock Data Generator for Development/Testing
 *
 * Generates realistic bid packages based on CSI MasterFormat divisions
 * without calling the Claude API.
 */

import { getDivisions, searchCSICodes, getAllCSICodes } from './csi/csiLookup';
import type { CSICode } from './csi/csiTypes';

export interface MockLineItem {
  id?: string;
  item_number?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  notes?: string | null;
  verified?: boolean;
  csiCode?: string | null;
  csiTitle?: string | null;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface MockBidPackage {
  name: string;
  csi_division: string;
  line_items: MockLineItem[];
}

export interface MockExtractionResult {
  project_name: string;
  bid_packages: MockBidPackage[];
  extraction_confidence: 'high' | 'medium' | 'low';
}

// Common construction units
const CONSTRUCTION_UNITS = [
  'LF', 'SF', 'CY', 'EA', 'SY', 'CF', 'LS', 'TON', 'GAL', 'LB', 'HR', 'DAY'
];

// Predefined bid items organized by CSI division (using full CSI format codes)
const PREDEFINED_BID_ITEMS: Record<string, string[]> = {
  '01 00 00': [ // General Requirements
    'Mobilization/Demobilization',
    'Permits and Inspections',
    'Project Closeout Documentation',
    'Testing and Balancing',
  ],
  '02 00 00': [ // Existing Conditions (Demolition)
    'Demo Existing Roofing - Roof A',
    'Demo Existing Roofing - Roof B',
    'Demo Existing Roofing - Roof C',
    'Demo Existing Roofing - Roof D',
    'Demo Existing Roofing - Roof E',
    'Demo Existing Roofing - Roof F',
    'Demo Existing Roofing - Roof G',
    'Demo Existing Roofing - Roof H',
    'Demo Parapet Flashing',
    'Demo Existing Scuppers',
    'Demo Roof Access Ladder',
    'Demo Wood Privacy Fence',
    'Demo RTU-1 and Curb',
    'Demo RTU-2 and Curb',
    'Demo RTU-3 and Curb (Alt #1)',
    'Demo RTU-4 and Curb (Alt #1)',
    'Demo RTU-5 and Curb (Alt #2)',
    'Demo RTU-6 and Curb (Alt #2)',
    'Demo Existing Gas Piping',
    'Demo HRV Unit and Ductwork',
    'Demo Exhaust Fan and Ductwork',
    'Demo Outside Air Intakes/Roof Vents',
    'Demo Wall Fan - Weight Room',
    'Demo Electrical Panel X',
    'Demo Electrical - MAU-1 thru MAU-4',
    'Remove/Replace Concrete Sidewalk',
  ],
  '03 00 00': [ // Concrete
    'Concrete Sidewalk',
    'Sidewalk Thickened Edge',
  ],
  '07 00 00': [ // Thermal & Moisture Protection (Roofing)
    'New Roofing System - Roof A',
    'New Roofing System - Roof B',
    'New Roofing System - Roof C',
    'New Roofing System - Roof D',
    'New Roofing System - Roof E',
    'New Roofing System - Roof F',
    'New Roofing System - Roof G',
    'New Roofing System - Roof H',
    'New Parapet Flashing',
    'New Sidewall Flashing',
    'Mechanical Equipment Flashing',
    'Roof Penetration Flashing',
  ],
  '22 00 00': [ // Plumbing
    'Roof Drain RD-1',
    'Overflow Roof Drain OD-1',
    '3" Rain Leader Piping',
    '4" Rain Leader Piping',
    '3" Overflow Leader Piping',
    '4" Overflow Leader Piping',
    'Rain Leader Cleanouts',
    'Rain Leader Pipe Insulation',
  ],
  '23 00 00': [ // HVAC
    'RTU-1 Racquetball',
    'RTU-2 Cardio',
    'RTU-3 2nd Floor Commons (Alt #1)',
    'RTU-4 1st Floor Lobby (Alt #1)',
    'RTU-5 Gym Locker Rooms (Alt #2)',
    'RTU-6 Gym (Alt #2)',
    'Factory Roof Curbs 24" High',
    'Field Fab Insulated Roof Curb RTU-5',
    'Field Fab Insulated Roof Curb RTU-6',
    'EF-1 Ceiling Exhaust Fan - Racquetball 1',
    'EF-2 Ceiling Exhaust Fan - Racquetball 2',
    'EF-3 Inline Exhaust Fan - Weight Room',
    'EF-4 Roof Exhaust Fan',
    'EF-5 Roof Exhaust Fan',
    'Exhaust Ductwork - 8" dia',
    'Exhaust Ductwork - 10" dia',
    'Doghouse 32"x32"x24" High',
    'Supply/Return Air Duct Transitions',
    'Air Diffusers Type A',
    'Gas Piping - 2" Main',
    'Gas Piping - 1-1/2"',
    'Gas Piping - 1-1/4"',
    'Gas Piping - 1"',
    'Gas Piping - 3/4"',
    'New Roof Relief Vents',
    'New Outside Air Intakes',
    'Motor Operated Damper',
    'Wall Mounted Timer Switches',
    'Duct Insulation',
    'Duct Lining',
    'Exterior Q-Duct Pre-Insulated',
  ],
  '26 00 00': [ // Electrical
    'New Panel MECH',
    'New Panel D',
    'Replace Main Breaker',
    'New Feeder - Main to Panel A',
    'New Feeder - Main to Panel MECH',
    'New Feeder - Panel A to Panel D',
    'RTU-1 Power Connection',
    'RTU-2 Power Connection',
    'RTU-3 Power Connection (Alt #1)',
    'RTU-4 Power Connection (Alt #1)',
    'RTU-5 Power Connection (Alt #2)',
    'RTU-6 Power Connection (Alt #2)',
    'EF-4 Power Connection',
    'EF-5 Power Connection',
    'EF-1 Power Connection',
    'EF-2 Power Connection',
    'EF-3 Power Connection',
    'Heat Trace System - Rain Leaders',
    'Heat Trace System - Overflow Leaders',
    'Heat Trace Controls',
    'Heat Trace Thermostat',
    'Duct Smoke Detector',
    'Audio Visual Alarm - Smoke Detector',
    'RTU Convenience Receptacles',
  ],
  '31 00 00': [ // Earthwork
    'Excavation - Roof Drain Field #1',
    'Excavation - Roof Drain Field #2',
    'Excavation - Rain Leader Trench',
    'Backfill - Drain Fields',
    'Backfill - Rain Leader Trench',
    'Compaction - 95% Max Dry Density',
  ],
  '32 00 00': [ // Exterior Improvements
    'Asphalt Paving - 2" Type IIA',
    'Asphalt Sawcut and Repair',
    'Topsoil and Seeding - 4"',
  ],
  '33 00 00': [ // Site Utilities
    'Roof Drain Field #1 - 30\'L x 15\'W x 3.5\'D',
    'Roof Drain Field #2 - 12\'L x 4\'W x 3.5\'D',
    '24" CPEP Pipe - Drain Field #1',
    '24" CPEP Pipe - Drain Field #2',
    '24" ADS Split Coupling',
    '24" x 4" ADS Reducer',
    '4" Rain Leader to Dry Well',
    '4" SCH40 ABS Monitoring Pipe',
    'Monitoring Pipe Riser Assembly',
    'Rain Leader Cleanout Assembly',
    '4" Insulfoam 40 EPS Insulation',
    'Typar 3401 Geotextile Fabric',
    'Coarse Grade Drain Rock',
    'Existing Dry Well Connection',
    'Vinyl Warning Tape',
  ],
};

// Map division codes to realistic unit distributions
const DIVISION_UNIT_MAP: Record<string, string[]> = {
  '01 00 00': ['LS', 'DAY', 'EA'],
  '02 00 00': ['SF', 'LF', 'EA', 'LS'],
  '03 00 00': ['SF', 'CY', 'LF'],
  '07 00 00': ['SF', 'LF', 'EA', 'SY'],
  '22 00 00': ['EA', 'LF', 'SF'],
  '23 00 00': ['EA', 'LF', 'SF', 'LS'],
  '26 00 00': ['EA', 'LF', 'LS'],
  '31 00 00': ['CY', 'SF', 'LF'],
  '32 00 00': ['SF', 'SY', 'TON'],
  '33 00 00': ['EA', 'LF', 'CY', 'SF'],
};

/**
 * Get a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random element from an array
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random quantity based on unit type
 */
function generateQuantity(unit: string): number {
  switch (unit) {
    case 'EA':
      return randomInt(1, 50);
    case 'LF':
      return randomInt(50, 500);
    case 'SF':
      return randomInt(100, 5000);
    case 'SY':
      return randomInt(50, 1000);
    case 'CY':
      return randomInt(5, 100);
    case 'CF':
      return randomInt(10, 200);
    case 'LS':
      return 1;
    case 'TON':
      return randomInt(1, 20);
    case 'GAL':
      return randomInt(10, 100);
    case 'LB':
      return randomInt(50, 500);
    case 'HR':
      return randomInt(8, 160);
    case 'DAY':
      return randomInt(1, 30);
    default:
      return randomInt(1, 100);
  }
}

/**
 * Generate a realistic unit price based on unit type
 */
function generateUnitPrice(unit: string): number {
  switch (unit) {
    case 'EA':
      return parseFloat((Math.random() * 500 + 50).toFixed(2));
    case 'LF':
      return parseFloat((Math.random() * 20 + 2).toFixed(2));
    case 'SF':
      return parseFloat((Math.random() * 15 + 1).toFixed(2));
    case 'SY':
      return parseFloat((Math.random() * 50 + 5).toFixed(2));
    case 'CY':
      return parseFloat((Math.random() * 100 + 50).toFixed(2));
    case 'CF':
      return parseFloat((Math.random() * 30 + 5).toFixed(2));
    case 'LS':
      return parseFloat((Math.random() * 5000 + 1000).toFixed(2));
    case 'TON':
      return parseFloat((Math.random() * 200 + 100).toFixed(2));
    case 'GAL':
      return parseFloat((Math.random() * 50 + 10).toFixed(2));
    case 'LB':
      return parseFloat((Math.random() * 10 + 1).toFixed(2));
    case 'HR':
      return parseFloat((Math.random() * 100 + 50).toFixed(2));
    case 'DAY':
      return parseFloat((Math.random() * 800 + 400).toFixed(2));
    default:
      return parseFloat((Math.random() * 100 + 10).toFixed(2));
  }
}

/**
 * Get appropriate unit for a division
 */
function getUnitForDivision(division: string): string {
  const units = DIVISION_UNIT_MAP[division] || CONSTRUCTION_UNITS;
  return randomChoice(units);
}

/**
 * Try to match a description to a CSI code
 * Uses progressive word trimming: if full description doesn't match,
 * 1. First trim words from the end until a match is found
 * 2. If still no match, trim words from the beginning until a match is found
 * Tries with division filter first, then without as fallback
 */
function matchToCSICode(description: string, division: string): {
  code: string | null;
  title: string | null;
  confidence: number;
} {
  if (!description || description.trim().length === 0) {
    return {
      code: 'N/A',
      title: 'No CSI match found',
      confidence: 0,
    };
  }

  // Clean the description and split into words
  const cleanDescription = description.trim();
  const words = cleanDescription.split(/[\s\-–—]+/).filter(w => w.length > 0);

  // Try with division filter first, then without
  const divisionFilters = [[division], []]; // First with division, then without

  for (const divisions of divisionFilters) {
    // Strategy 1: Trim words from the END
    for (let wordCount = words.length; wordCount >= 1; wordCount--) {
      const searchTermWords = words.slice(0, wordCount);
      const searchTerm = searchTermWords.join(' ');

      // Skip if search term is too short
      if (searchTerm.length < 2) {
        continue;
      }

      // Search for matching CSI codes
      const searchResults = searchCSICodes({
        query: searchTerm,
        divisions: divisions,
        limit: 3,
      });

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];

        // Calculate confidence based on score
        // Lower confidence if we had to search outside the expected division
        let confidence: number;
        const divisionMatch = divisions.length > 0;
        if (bestMatch.score > 80) {
          confidence = divisionMatch ? randomInt(80, 100) : randomInt(70, 90);
        } else if (bestMatch.score > 40) {
          confidence = divisionMatch ? randomInt(50, 79) : randomInt(40, 69);
        } else {
          confidence = divisionMatch ? randomInt(20, 49) : randomInt(15, 39);
        }

        const searchScope = divisions.length > 0 ? `division ${division}` : 'all divisions';
        console.log(`CSI match for "${searchTerm}" (from "${description}", trim-end) in ${searchScope}: ${bestMatch.code.code} - ${bestMatch.code.title}`);

        return {
          code: bestMatch.code.code,
          title: bestMatch.code.title,
          confidence,
        };
      }
    }

    // Strategy 2: Trim words from the BEGINNING
    for (let startIdx = 1; startIdx < words.length; startIdx++) {
      const searchTermWords = words.slice(startIdx);
      const searchTerm = searchTermWords.join(' ');

      // Skip if search term is too short
      if (searchTerm.length < 2) {
        continue;
      }

      // Search for matching CSI codes
      const searchResults = searchCSICodes({
        query: searchTerm,
        divisions: divisions,
        limit: 3,
      });

      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];

        // Calculate confidence - slightly lower for trim-from-beginning matches
        let confidence: number;
        const divisionMatch = divisions.length > 0;
        if (bestMatch.score > 80) {
          confidence = divisionMatch ? randomInt(70, 95) : randomInt(60, 85);
        } else if (bestMatch.score > 40) {
          confidence = divisionMatch ? randomInt(40, 69) : randomInt(30, 59);
        } else {
          confidence = divisionMatch ? randomInt(15, 39) : randomInt(10, 34);
        }

        const searchScope = divisions.length > 0 ? `division ${division}` : 'all divisions';
        console.log(`CSI match for "${searchTerm}" (from "${description}", trim-start) in ${searchScope}: ${bestMatch.code.code} - ${bestMatch.code.title}`);

        return {
          code: bestMatch.code.code,
          title: bestMatch.code.title,
          confidence,
        };
      }
    }
  }

  // No match found even after all trimming strategies in all divisions
  console.log(`No CSI match found for "${description}" even after all trimming strategies in all divisions`);
  return {
    code: 'N/A',
    title: 'No CSI match found',
    confidence: 0,
  };
}

/**
 * Generate mock bounding box (normalized coordinates 0-1)
 */
function generateBoundingBox(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const x = Math.random() * 0.7; // Leave some margin
  const y = Math.random() * 0.7;
  const width = Math.random() * 0.2 + 0.1; // 10-30% width
  const height = Math.random() * 0.05 + 0.02; // 2-7% height

  return {
    x: parseFloat(x.toFixed(3)),
    y: parseFloat(y.toFixed(3)),
    width: parseFloat(width.toFixed(3)),
    height: parseFloat(height.toFixed(3)),
  };
}

/**
 * Generate mock line items for a division using predefined items
 */
function generateLineItems(division: string): MockLineItem[] {
  const lineItems: MockLineItem[] = [];
  const predefinedItems = PREDEFINED_BID_ITEMS[division];

  if (!predefinedItems || predefinedItems.length === 0) {
    // If no predefined items for this division, return empty array
    return [];
  }

  // Use all predefined items for this division
  predefinedItems.forEach((description, i) => {
    const unit = getUnitForDivision(division);
    const quantity = generateQuantity(unit);
    const unitPrice = generateUnitPrice(unit);
    const totalPrice = parseFloat((quantity * unitPrice).toFixed(2));

    // Match to CSI code
    const csiMatch = matchToCSICode(description, division);

    // Extract just the division number from format "XX 00 00" for item numbering
    const divisionNumber = division.split(' ')[0];

    lineItems.push({
      item_number: `${divisionNumber}-${String(i + 1).padStart(3, '0')}`,
      description,
      quantity,
      unit,
      unit_price: unitPrice,
      total_price: totalPrice,
      notes: null,
      verified: false,
      csiCode: csiMatch.code,
      csiTitle: csiMatch.title,
      confidence: csiMatch.confidence,
      boundingBox: generateBoundingBox(),
    });
  });

  return lineItems;
}

/**
 * Generate mock bid packages from predefined items
 */
export function generateMockBidPackages(): MockExtractionResult {
  const allDivisions = getDivisions();

  // Get divisions that have predefined items
  const divisionsWithItems = Object.keys(PREDEFINED_BID_ITEMS);

  // Map division codes to CSI division objects
  const selectedDivisions: CSICode[] = divisionsWithItems
    .map(divCode => {
      const division = allDivisions.find(d => d.code === divCode);
      return division;
    })
    .filter((div): div is CSICode => div !== undefined);

  // Generate bid packages for all divisions with predefined items
  const bidPackages: MockBidPackage[] = selectedDivisions.map(division => {
    const lineItems = generateLineItems(division.code);

    return {
      name: `${division.code} - ${division.title}`,
      csi_division: division.code,
      line_items: lineItems,
    };
  });

  // Calculate overall confidence
  let totalConfidence = 0;
  let itemCount = 0;

  bidPackages.forEach(pkg => {
    pkg.line_items.forEach(item => {
      totalConfidence += item.confidence || 0;
      itemCount++;
    });
  });

  const avgConfidence = itemCount > 0 ? totalConfidence / itemCount : 50;

  let extractionConfidence: 'high' | 'medium' | 'low';
  if (avgConfidence >= 70) {
    extractionConfidence = 'high';
  } else if (avgConfidence >= 40) {
    extractionConfidence = 'medium';
  } else {
    extractionConfidence = 'low';
  }

  return {
    project_name: `Mock Project ${new Date().toISOString().split('T')[0]}`,
    bid_packages: bidPackages,
    extraction_confidence: extractionConfidence,
  };
}

/**
 * Generate mock extraction result with delay to simulate API call
 */
export async function generateMockExtraction(delayMs: number = 2000): Promise<MockExtractionResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, delayMs));

  return generateMockBidPackages();
}
