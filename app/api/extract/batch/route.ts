import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  categorizeLineItems,
  organizeIntoBidPackages,
  extractProjectName
} from '@/lib/bid-package-utils';
import { generateCopyName } from '@/lib/file-utils';
import { isPDFFile, processPDFForExtraction } from '@/lib/pdf-utils';
import { generateMockBidPackages } from '@/lib/mockDataGenerator';

interface ExtractionRequest {
  diagramId: string;
  imageUrl: string;
  fileName: string;
  fileHash?: string;
}

interface ExtractionResult {
  diagramId: string;
  success: boolean;
  project_name?: string | null;
  line_items: any[];
  extraction_confidence?: string;
  error?: string;
}

// Helper function to extract from a single image
async function extractSingleImage(
  client: Anthropic,
  imageBuffer: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<any> {
  const base64Image = imageBuffer.toString('base64');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Analyze this construction/preconstruction diagram or work drawing and extract all bid items and information.

Please extract the following information in a structured format:
1. Project name or title (if visible)
2. All line items with:
   - Item number (if present)
   - Description of work/material
   - Quantity (if specified)
   - Unit of measurement (e.g., LF, SF, EA, CY, etc.)
   - Any relevant notes or specifications

NOTE: Do not extract pricing information (unit prices or totals). This is a quantity takeoff only.

IMPORTANT: Carefully identify the trade/category for each item based on its description. Common categories include:
- Plumbing (pipes, drains, fixtures, water systems)
- Electrical (wiring, outlets, panels, lighting)
- HVAC (heating, cooling, ventilation, ductwork)
- Framing (studs, joists, beams, structural)
- Drywall (gypsum, partitions, ceilings)
- Flooring (carpet, tile, vinyl, hardwood)
- Roofing (shingles, membranes, gutters)
- Concrete (foundations, slabs, footings)
- Painting (paint, coatings, finishes)
- Landscaping (plants, irrigation, hardscape)
- General Conditions (supervision, temporary facilities, safety)

Format your response as a JSON object with this structure:
{
  "project_name": "string or null",
  "line_items": [
    {
      "item_number": "string or null",
      "description": "string",
      "quantity": number or null,
      "unit": "string or null",
      "notes": "string or null"
    }
  ],
  "extraction_confidence": "high/medium/low"
}

If this is not a construction diagram or you cannot extract meaningful bid information, return an empty line_items array and set extraction_confidence to "low".`,
          },
        ],
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse JSON response
  let result;
  try {
    if (responseText.includes('```json')) {
      const jsonStart = responseText.indexOf('```json') + 7;
      const jsonEnd = responseText.indexOf('```', jsonStart);
      const jsonStr = responseText.substring(jsonStart, jsonEnd).trim();
      result = JSON.parse(jsonStr);
    } else if (responseText.includes('{')) {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      const jsonStr = responseText.substring(jsonStart, jsonEnd);
      result = JSON.parse(jsonStr);
    } else {
      result = {
        project_name: null,
        line_items: [],
        extraction_confidence: 'low',
      };
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    result = {
      project_name: null,
      line_items: [],
      extraction_confidence: 'low',
    };
  }

  return result;
}

async function extractFromDiagram(
  client: Anthropic,
  request: ExtractionRequest
): Promise<ExtractionResult> {
  try {
    const { diagramId, imageUrl, fileName } = request;

    let fileBuffer: Buffer;
    let isPDF = false;

    // Check if this is a local file path or remote URL
    if (imageUrl.startsWith('/uploads/')) {
      // Local file - read from disk
      const filepath = path.join(process.cwd(), 'public', imageUrl);
      fileBuffer = await readFile(filepath);

      // Check if this is a PDF
      isPDF = isPDFFile(imageUrl) || isPDFFile(fileBuffer);
    } else {
      // Remote URL - fetch it
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      // Check if this is a PDF
      const contentType = response.headers.get('content-type') || '';
      isPDF = contentType.includes('pdf') || isPDFFile(fileBuffer);
    }

    let allLineItems: any[] = [];
    let projectName: string | null = null;
    let extractionConfidence = 'medium';

    if (isPDF) {
      // Process PDF: convert to images
      const pdfResult = await processPDFForExtraction(fileBuffer, {
        maxPages: 10,
        includeText: false // Don't need text extraction for batch processing
      });

      console.log(`Processing PDF with ${pdfResult.images.length} pages`);

      // Process each page
      for (const pageImage of pdfResult.images) {
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
        if (pageImage.contentType.includes('jpeg')) {
          mediaType = 'image/jpeg';
        }

        const result = await extractSingleImage(
          client,
          pageImage.imageBuffer,
          mediaType
        );

        if (result.project_name && !projectName) {
          projectName = result.project_name;
        }

        if (result.line_items) {
          // Add page number to items for reference
          const itemsWithPage = result.line_items.map((item: any) => ({
            ...item,
            source_page: pageImage.pageNumber,
            notes: item.notes
              ? `${item.notes} (Page ${pageImage.pageNumber})`
              : `Page ${pageImage.pageNumber}`
          }));
          allLineItems.push(...itemsWithPage);
        }
      }
    } else {
      // Process as regular image
      let contentType = 'image/jpeg';

      // Determine content type from file extension
      const ext = path.extname(imageUrl).toLowerCase();
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';

      // Determine media type from content-type
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
      if (contentType.includes('png')) mediaType = 'image/png';
      else if (contentType.includes('gif')) mediaType = 'image/gif';
      else if (contentType.includes('webp')) mediaType = 'image/webp';

      const result = await extractSingleImage(client, fileBuffer, mediaType);

      projectName = result.project_name;
      allLineItems = result.line_items || [];
      extractionConfidence = result.extraction_confidence || 'medium';
    }

    return {
      diagramId,
      success: true,
      project_name: projectName,
      line_items: allLineItems,
      extraction_confidence: extractionConfidence,
    };
  } catch (error) {
    console.error(`Extraction failed for ${request.fileName}:`, error);
    return {
      diagramId: request.diagramId,
      success: false,
      line_items: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      diagrams,
      bcProjectId,
      createNewProject = false,
      projectName: providedProjectName,
      isDuplicate = false,
      originalProjectId,
      useMockData = false
    } = body;

    if (!diagrams || !Array.isArray(diagrams) || diagrams.length === 0) {
      return NextResponse.json(
        { error: 'No diagrams provided' },
        { status: 400 }
      );
    }

    // Mock mode: Skip Claude API and generate mock data
    let allLineItems: any[] = [];
    let extractedProjectName: string | null = null;
    let extractionResults: ExtractionResult[] = [];

    if (useMockData) {
      console.log('Mock mode enabled for batch extraction - generating mock data');

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock bid packages
      const mockData = generateMockBidPackages();

      console.log(`Generated ${mockData.bid_packages.length} mock bid packages`);

      // Flatten mock packages into line items for categorization
      for (const pkg of mockData.bid_packages) {
        allLineItems.push(...(pkg.line_items || []));
      }

      extractedProjectName = mockData.project_name;

      // Create mock extraction results
      extractionResults = diagrams.map((diagram: ExtractionRequest) => ({
        diagramId: diagram.diagramId,
        success: true,
        project_name: mockData.project_name,
        line_items: [],
        extraction_confidence: mockData.extraction_confidence,
      }));

      console.log(`Mock extraction complete with ${allLineItems.length} total line items`);
    } else {
      // Real extraction mode
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'ANTHROPIC_API_KEY not configured' },
          { status: 500 }
        );
      }

      const client = new Anthropic({ apiKey });

      // Process all diagrams in parallel for efficiency
      const extractionPromises = diagrams.map((diagram: ExtractionRequest) =>
        extractFromDiagram(client, diagram)
      );

      extractionResults = await Promise.all(extractionPromises);

      // Combine all line items from all diagrams
      for (const result of extractionResults) {
        if (result.success && result.line_items) {
          allLineItems.push(...result.line_items);
        }
        if (result.project_name && !extractedProjectName) {
          extractedProjectName = result.project_name;
        }
      }
    }

    // Determine the final project name
    let finalProjectName = providedProjectName || extractedProjectName || 'Untitled Project';

    // If this is a duplicate, generate a copy name
    if (isDuplicate) {
      // Get existing project names to avoid conflicts
      const existingProjects = await prisma.buildingConnectedProject.findMany({
        select: { name: true }
      });
      const existingNames = existingProjects.map(p => p.name);
      finalProjectName = generateCopyName(finalProjectName, existingNames);
    }

    // Categorize all line items and organize into bid packages
    const categorizedItems = categorizeLineItems(allLineItems);
    const bidPackages = organizeIntoBidPackages(categorizedItems);

    // Create or update project in database
    let projectId: string;
    let project: any;

    if (bcProjectId && !createNewProject) {
      // Update existing project
      project = await prisma.buildingConnectedProject.findUnique({
        where: { id: bcProjectId },
        include: {
          diagrams: true,
          bidPackages: true
        }
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      projectId = bcProjectId;
    } else {
      // Create new project
      const newProjectData: any = {
        bcProjectId: `bc-${Date.now()}`,
        name: finalProjectName,
        status: 'active',
        description: `Extracted from ${diagrams.length} diagram(s)`,
        diagrams: {
          create: diagrams.map((d: any) => ({
            fileName: d.fileName,
            fileUrl: d.imageUrl,
            fileType: 'image/png',
            fileSize: 0, // We don't have this info in batch extraction
            fileHash: d.fileHash
          }))
        },
        bidPackages: {
          create: bidPackages.map((pkg: any) => ({
            bcBidPackageId: `bp-${pkg.category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            name: pkg.name,
            description: pkg.description,
            status: 'draft',
            progress: 0,
            scope: `${pkg.itemCount} items`
          }))
        }
      };

      // If this is a copy, link it to the original project somehow
      if (isDuplicate && originalProjectId) {
        newProjectData.description = `Copy of project - ${newProjectData.description}`;
      }

      project = await prisma.buildingConnectedProject.create({
        data: newProjectData,
        include: {
          diagrams: true,
          bidPackages: true
        }
      });

      projectId = project.id;

      // Create BidForms and LineItems for each bid package
      for (let i = 0; i < bidPackages.length; i++) {
        const pkg = bidPackages[i];
        const dbPackage = project.bidPackages[i];

        if (dbPackage && pkg.items.length > 0) {
          await prisma.bidForm.create({
            data: {
              bidPackageId: dbPackage.id,
              extractionConfidence: 'medium',
              status: 'draft',
              lineItems: {
                create: pkg.items.map((item: any, index: number) => ({
                  itemNumber: item.item_number || null,
                  description: item.description,
                  quantity: item.quantity || null,
                  unit: item.unit || null,
                  notes: item.notes || null,
                  order: index,
                  verified: false
                }))
              }
            }
          });
        }
      }
    }

    // Prepare response
    const response = {
      success: true,
      projectId: projectId,
      projectName: finalProjectName,
      message: `Successfully processed ${diagrams.length} diagram(s)`,
      bidPackages: bidPackages.map((pkg: any) => ({
        id: pkg.id || `temp-${pkg.category}`,
        name: pkg.name,
        category: pkg.category,
        itemCount: pkg.itemCount,
      })),
      extractionResults: extractionResults.map(r => ({
        diagramId: r.diagramId,
        success: r.success,
        itemCount: r.line_items?.length || 0,
        confidence: r.extraction_confidence,
        error: r.error
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Batch extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch extraction' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch processing