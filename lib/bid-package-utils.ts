import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Trade categories for bid package classification
export const TRADE_CATEGORIES = {
  PLUMBING: {
    name: 'Plumbing',
    keywords: ['plumbing', 'pipe', 'drain', 'water', 'sewer', 'faucet', 'toilet', 'sink', 'valve', 'fixture', 'copper', 'pex', 'pvc', 'waste', 'supply', 'hot water', 'cold water', 'sanitary', 'storm drain', 'water heater', 'backflow'],
    patterns: [/plumb/i, /pipe/i, /drain/i, /water/i, /sewer/i, /fixture/i]
  },
  ELECTRICAL: {
    name: 'Electrical',
    keywords: ['electrical', 'wire', 'cable', 'outlet', 'switch', 'panel', 'breaker', 'circuit', 'voltage', 'amp', 'watt', 'conduit', 'junction', 'lighting', 'power', 'receptacle', 'transformer', 'generator', 'meter', 'grounding'],
    patterns: [/electric/i, /wire/i, /circuit/i, /volt/i, /amp/i, /power/i]
  },
  HVAC: {
    name: 'HVAC',
    keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'ventilation', 'duct', 'furnace', 'air handler', 'compressor', 'thermostat', 'vav', 'rtu', 'chiller', 'boiler', 'fan', 'damper', 'diffuser', 'grille', 'refrigerant'],
    patterns: [/hvac/i, /heat/i, /cool/i, /ventilat/i, /duct/i, /air\s+condition/i]
  },
  FRAMING: {
    name: 'Framing',
    keywords: ['framing', 'stud', 'joist', 'beam', 'column', 'header', 'rafter', 'truss', 'plate', 'sill', 'sheathing', 'structural', 'wood', 'lumber', '2x4', '2x6', 'steel frame', 'metal stud'],
    patterns: [/fram/i, /stud/i, /joist/i, /beam/i, /structural/i, /lumber/i]
  },
  DRYWALL: {
    name: 'Drywall',
    keywords: ['drywall', 'sheetrock', 'gypsum', 'partition', 'taping', 'mudding', 'texture', 'ceiling', 'wall board', 'corner bead', 'joint compound', 'acoustic', 'fire rated'],
    patterns: [/drywall/i, /sheetrock/i, /gypsum/i, /partition/i]
  },
  FLOORING: {
    name: 'Flooring',
    keywords: ['flooring', 'carpet', 'tile', 'vinyl', 'hardwood', 'laminate', 'ceramic', 'porcelain', 'epoxy', 'concrete', 'subfloor', 'underlayment', 'base', 'transition', 'threshold', 'grout'],
    patterns: [/floor/i, /carpet/i, /tile/i, /vinyl/i, /hardwood/i]
  },
  ROOFING: {
    name: 'Roofing',
    keywords: ['roofing', 'shingle', 'membrane', 'flashing', 'gutter', 'downspout', 'fascia', 'soffit', 'ridge', 'valley', 'epdm', 'tpo', 'modified bitumen', 'metal roof', 'slate', 'parapet'],
    patterns: [/roof/i, /shingle/i, /gutter/i, /flashing/i]
  },
  CONCRETE: {
    name: 'Concrete',
    keywords: ['concrete', 'foundation', 'footing', 'slab', 'pour', 'rebar', 'formwork', 'cement', 'grade beam', 'caisson', 'pier', 'retaining wall', 'curb', 'sidewalk', 'paving'],
    patterns: [/concrete/i, /foundation/i, /slab/i, /cement/i, /rebar/i]
  },
  PAINTING: {
    name: 'Painting',
    keywords: ['painting', 'paint', 'primer', 'coating', 'finish', 'stain', 'sealer', 'caulk', 'wallpaper', 'epoxy coating', 'texture coating'],
    patterns: [/paint/i, /coating/i, /stain/i, /primer/i]
  },
  LANDSCAPING: {
    name: 'Landscaping',
    keywords: ['landscaping', 'irrigation', 'sprinkler', 'planting', 'tree', 'shrub', 'grass', 'sod', 'mulch', 'soil', 'drainage', 'hardscape', 'pavers', 'retaining wall'],
    patterns: [/landscap/i, /irrigation/i, /plant/i, /tree/i, /grass/i]
  },
  GENERAL_CONDITIONS: {
    name: 'General Conditions',
    keywords: ['general conditions', 'supervision', 'temporary', 'protection', 'safety', 'cleanup', 'mobilization', 'permit', 'insurance', 'bond', 'overhead', 'profit', 'dumpster', 'portable toilet', 'fence'],
    patterns: [/general\s+condition/i, /supervision/i, /temporary/i, /permit/i]
  }
};

/**
 * Categorize a line item based on its description
 */
export function categorizeLineItem(description: string): string {
  const lowerDesc = description.toLowerCase();

  for (const [category, config] of Object.entries(TRADE_CATEGORIES)) {
    // Check keywords
    for (const keyword of config.keywords) {
      if (lowerDesc.includes(keyword)) {
        return config.name;
      }
    }

    // Check patterns
    for (const pattern of config.patterns) {
      if (pattern.test(description)) {
        return config.name;
      }
    }
  }

  return 'General'; // Default category
}

/**
 * Categorize multiple line items and group them by trade
 */
export function categorizeLineItems(items: Array<{ description: string; [key: string]: any }>) {
  const categorized: Record<string, typeof items> = {};

  for (const item of items) {
    const category = categorizeLineItem(item.description);
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(item);
  }

  return categorized;
}

/**
 * Create or get bid packages for a project based on categories
 */
export async function createOrGetBidPackages(bcProjectId: string, categories: string[]) {
  const bidPackages: Record<string, any> = {};

  for (const category of categories) {
    // Check if bid package already exists
    let bidPackage = await prisma.bidPackage.findFirst({
      where: {
        bcProjectId,
        name: { contains: category, mode: 'insensitive' }
      }
    });

    if (!bidPackage) {
      // Create new bid package
      const bcBidPackageId = `bp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      bidPackage = await prisma.bidPackage.create({
        data: {
          bcBidPackageId,
          bcProjectId,
          name: `${category} Package`,
          status: 'to do'
        }
      });
    }

    bidPackages[category] = bidPackage;
  }

  return bidPackages;
}

/**
 * Process extraction results and organize into bid packages
 */
export async function organizeIntoBidPackages(
  bcProjectId: string,
  extractionResults: Array<{
    diagramId?: string;
    project_name?: string;
    line_items: Array<{
      description: string;
      item_number?: string;
      quantity?: number;
      unit?: string;
      notes?: string;
      boundingBox?: any;
    }>;
    extraction_confidence?: string;
  }>
) {
  // Collect all line items from all extractions
  const allLineItems: Array<any> = [];
  const diagramIds: string[] = [];

  for (const result of extractionResults) {
    if (result.diagramId) {
      diagramIds.push(result.diagramId);
    }
    if (result.line_items && result.line_items.length > 0) {
      allLineItems.push(...result.line_items.map(item => ({
        ...item,
        diagramId: result.diagramId,
        extractionConfidence: result.extraction_confidence
      })));
    }
  }

  // Categorize all line items
  const categorizedItems = categorizeLineItems(allLineItems);
  const categories = Object.keys(categorizedItems);

  // Create or get bid packages for each category
  const bidPackages = await createOrGetBidPackages(bcProjectId, categories);

  // Create bid forms and line items for each bid package
  const results = [];

  for (const [category, items] of Object.entries(categorizedItems)) {
    const bidPackage = bidPackages[category];

    // Update bid package with diagram references
    const existingDiagramIds = bidPackage.diagramIds ? JSON.parse(bidPackage.diagramIds) : [];
    const updatedDiagramIds = Array.from(new Set([...existingDiagramIds, ...diagramIds]));

    await prisma.bidPackage.update({
      where: { id: bidPackage.id },
      data: {
        diagramIds: JSON.stringify(updatedDiagramIds)
      }
    });

    // Create bid form for this package
    const bidForm = await prisma.bidForm.create({
      data: {
        bidPackageId: bidPackage.id,
        diagramId: diagramIds[0] || null, // Link to first diagram
        extractionConfidence: items[0].extractionConfidence || 'unknown',
        status: 'draft',
        lineItems: {
          create: (items as any[]).map((item, index) => ({
            itemNumber: item.item_number || null,
            description: item.description,
            quantity: item.quantity || null,
            unit: item.unit || null,
            notes: item.notes || null,
            order: index,
            verified: false
          }))
        }
      },
      include: {
        lineItems: {
          orderBy: { order: 'asc' }
        }
      }
    });

    results.push({
      bidPackage,
      bidForm,
      itemCount: items.length,
      category
    });
  }

  return results;
}

/**
 * Extract project name from file name or use default
 */
export function extractProjectName(fileName: string, extractedName?: string | null): string {
  if (extractedName) return extractedName;

  // Remove file extension and clean up
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const cleanName = baseName
    .replace(/[-_]/g, ' ')
    .replace(/\d{4,}/g, '') // Remove long numbers (timestamps)
    .replace(/\s+/g, ' ')
    .trim();

  return cleanName || 'Untitled Project';
}