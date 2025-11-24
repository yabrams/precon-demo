import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { isPDFFile, processPDFForExtraction } from '@/lib/pdf-utils';

// Helper function to process a single image with Claude
async function processImageWithClaude(
  client: Anthropic,
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  userInstructions?: string,
  contextNote?: string
) {
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
            text: `Analyze this construction/preconstruction diagram or work drawing and extract bid packages and items.
${contextNote ? `\nCONTEXT: ${contextNote}\n` : ''}
${userInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${userInstructions}\n` : ''}

IMPORTANT: Follow this TWO-STEP process:

STEP 1: IDENTIFY BID PACKAGES
First, identify all the different bid packages needed based on CSI MasterFormat divisions visible in the document:
- Division 02: Site Construction (excavation, grading, utilities)
- Division 03: Concrete (foundations, slabs, structural)
- Division 04: Masonry (brick, block, stone)
- Division 05: Metals (structural steel, metal deck, misc metals)
- Division 06: Wood & Plastics (framing, millwork)
- Division 07: Thermal & Moisture (roofing, insulation, waterproofing)
- Division 08: Doors & Windows (doors, frames, glazing)
- Division 09: Finishes (drywall, painting, flooring, ceilings)
- Division 10: Specialties (toilet partitions, signage, accessories)
- Division 11: Equipment (kitchen, lab, medical equipment)
- Division 12: Furnishings (furniture, window treatments)
- Division 13: Special Construction (clean rooms, vaults)
- Division 14: Conveying (elevators, escalators)
- Division 15: Mechanical (HVAC, plumbing, fire protection)
- Division 16: Electrical (power, lighting, communications)

STEP 2: EXTRACT AND ASSIGN ITEMS
Extract all line items and assign each to the appropriate bid package:
- Item number (if present)
- Description of work/material
- Quantity (if specified)
- Unit of measurement (e.g., LF, SF, EA, CY, etc.)
- CSI division it belongs to
- Any relevant notes or specifications
- Bounding box coordinates (normalized 0.0-1.0)

Format your response as a JSON object:
{
  "project_name": "string or null",
  "bid_packages": [
    {
      "name": "Division XX - Description",
      "csi_division": "XX",
      "description": "Brief description of scope",
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "quantity": number or null,
          "unit": "string or null",
          "notes": "string or null",
          "boundingBox": {
            "x": number (0.0-1.0),
            "y": number (0.0-1.0),
            "width": number (0.0-1.0),
            "height": number (0.0-1.0)
          } or null
        }
      ]
    }
  ],
  "extraction_confidence": "high/medium/low"
}

IMPORTANT RULES:
1. Create separate bid packages for each CSI division that has items
2. If you cannot determine specific CSI divisions, create a single "GENERAL" package
3. Always assign every item to a bid package
4. Use standard CSI division naming (e.g., "Division 09 - Finishes")
5. Do not extract pricing information`,
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
      const jsonStart = responseText.indexOf('```json') + '```json'.length;
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
        bid_packages: [{
          name: 'GENERAL',
          csi_division: '00',
          description: 'General bid items',
          line_items: []
        }],
        extraction_confidence: 'low',
        raw_text: responseText,
      };
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Response text:', responseText);
    result = {
      project_name: null,
      bid_packages: [{
        name: 'GENERAL',
        csi_division: '00',
        description: 'General bid items',
        line_items: []
      }],
      extraction_confidence: 'low',
      raw_text: responseText,
    };
  }

  // Ensure at least one bid package exists
  if (!result.bid_packages || result.bid_packages.length === 0) {
    result.bid_packages = [{
      name: 'GENERAL',
      csi_division: '00',
      description: 'General bid items',
      line_items: []
    }];
  }

  return result;
}

// Helper function to combine extraction results from multiple pages
function combineExtractionResults(results: any[]) {
  if (results.length === 0) {
    return {
      project_name: null,
      bid_packages: [{
        name: 'GENERAL',
        csi_division: '00',
        description: 'General bid items',
        line_items: []
      }],
      extraction_confidence: 'low'
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  // Combine results from multiple pages
  const combined = {
    project_name: null as string | null,
    bid_packages: new Map<string, any>(),
    extraction_confidence: 'medium' as string,
    page_count: results.length
  };

  // Use the first non-null project name found
  for (const result of results) {
    if (result.project_name) {
      combined.project_name = result.project_name;
      break;
    }
  }

  // Combine bid packages from all pages
  for (const result of results) {
    const pageNumber = result.pageNumber || 1;

    if (result.bid_packages && Array.isArray(result.bid_packages)) {
      for (const pkg of result.bid_packages) {
        const key = `${pkg.csi_division}-${pkg.name}`;

        if (!combined.bid_packages.has(key)) {
          combined.bid_packages.set(key, {
            name: pkg.name,
            csi_division: pkg.csi_division,
            description: pkg.description,
            line_items: []
          });
        }

        const existingPkg = combined.bid_packages.get(key);
        if (pkg.line_items && Array.isArray(pkg.line_items)) {
          pkg.line_items.forEach((item: any) => {
            existingPkg.line_items.push({
              ...item,
              source_page: pageNumber,
              notes: item.notes ? `${item.notes} (Page ${pageNumber})` : `Page ${pageNumber}`
            });
          });
        }
      }
    }
  }

  // Convert Map back to array
  const packagesArray = Array.from(combined.bid_packages.values());

  // If no packages were found, create a GENERAL package
  if (packagesArray.length === 0) {
    packagesArray.push({
      name: 'GENERAL',
      csi_division: '00',
      description: 'General bid items',
      line_items: []
    });
  }

  // Determine overall confidence
  const confidenceLevels = results.map(r => r.extraction_confidence || 'low');
  if (confidenceLevels.every(c => c === 'high')) {
    combined.extraction_confidence = 'high';
  } else if (confidenceLevels.some(c => c === 'low')) {
    combined.extraction_confidence = 'low';
  }

  return {
    project_name: combined.project_name,
    bid_packages: packagesArray,
    extraction_confidence: combined.extraction_confidence,
    page_count: combined.page_count
  };
}

export async function POST(request: Request) {
  try {
    const { imageUrl, instructions, projectId, diagramId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL provided' },
        { status: 400 }
      );
    }

    // If projectId is provided, verify it exists
    if (projectId) {
      const project = await prisma.buildingConnectedProject.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    // If diagramId is provided, verify it exists
    if (diagramId) {
      const diagram = await prisma.diagram.findUnique({
        where: { id: diagramId }
      });

      if (!diagram) {
        return NextResponse.json(
          { error: 'Diagram not found' },
          { status: 404 }
        );
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

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

    // Process differently based on file type
    let extractionResults: any[] = [];

    if (isPDF) {
      console.log('Processing PDF file...');

      // Process PDF: convert to images and extract text
      const pdfResult = await processPDFForExtraction(fileBuffer, {
        maxPages: 10, // Process up to 10 pages
        includeText: true
      });

      console.log(`PDF has ${pdfResult.info.pageCount} pages, processing ${pdfResult.images.length} pages`);

      // Process each page image with Claude
      for (const pageImage of pdfResult.images) {
        const base64Image = pageImage.imageBuffer.toString('base64');
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
        if (pageImage.contentType.includes('jpeg')) {
          mediaType = 'image/jpeg';
        }

        const pageResult = await processImageWithClaude(
          client,
          base64Image,
          mediaType,
          instructions,
          `Page ${pageImage.pageNumber} of PDF. ${pdfResult.text ? 'Additional context from PDF text extraction is available.' : ''}`
        );

        extractionResults.push({
          ...pageResult,
          pageNumber: pageImage.pageNumber
        });
      }
    } else {
      // Process as regular image
      const imageBuffer = fileBuffer.buffer;
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Determine content type from file extension
      let contentType = 'image/jpeg';
      const ext = path.extname(imageUrl).toLowerCase();
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';

      // Determine media type from content-type
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
      if (contentType.includes('png')) mediaType = 'image/png';
      else if (contentType.includes('gif')) mediaType = 'image/gif';
      else if (contentType.includes('webp')) mediaType = 'image/webp';

      const result = await processImageWithClaude(client, base64Image, mediaType, instructions);
      extractionResults.push(result);
    }

    // Combine results from all pages/images
    const combinedResult = combineExtractionResults(extractionResults);

    console.log('Extraction result:', JSON.stringify(combinedResult, null, 2));
    console.log('Bid packages count:', combinedResult.bid_packages?.length || 0);

    // Log total line items across all packages
    const totalLineItems = combinedResult.bid_packages?.reduce((sum: number, pkg: any) =>
      sum + (pkg.line_items?.length || 0), 0) || 0;
    console.log('Total line items across all packages:', totalLineItems);

    const result = combinedResult;

    // If projectId is provided, create bid packages and forms
    if (projectId && result.bid_packages && result.bid_packages.length > 0) {
      try {
        // Create bid packages and forms for each identified package
        const createdPackages = await Promise.all(
          result.bid_packages.map(async (pkg: any) => {
            // Check if package has any line items
            if (!pkg.line_items || pkg.line_items.length === 0) {
              console.log(`Skipping empty package: ${pkg.name}`);
              return null;
            }

            // Create or find the bid package
            const bidPackage = await prisma.bidPackage.create({
              data: {
                bcBidPackageId: `${projectId}-${pkg.csi_division}-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                bcProjectId: projectId,
                name: pkg.name,
                description: pkg.description || `${pkg.name} scope of work`,
                scope: pkg.description,
                status: 'draft',
                progress: 0,
                diagramIds: diagramId ? JSON.stringify([diagramId]) : null,
              }
            });

            // Create bid form with line items for this package
            const bidForm = await prisma.bidForm.create({
              data: {
                bidPackageId: bidPackage.id,
                diagramId: diagramId || null,
                extractionConfidence: result.extraction_confidence || 'unknown',
                rawExtractedText: result.raw_text || null,
                status: 'draft',
                lineItems: {
                  create: pkg.line_items.map((item: any, index: number) => ({
                    itemNumber: item.item_number || null,
                    description: item.description,
                    quantity: item.quantity || null,
                    unit: item.unit || null,
                    unitPrice: item.unit_price || null,
                    totalPrice: item.total_price || null,
                    notes: item.notes || null,
                    order: index,
                    verified: false
                  }))
                }
              },
              include: {
                lineItems: {
                  orderBy: {
                    order: 'asc'
                  }
                }
              }
            });

            console.log(`Created BidPackage: ${bidPackage.id} (${pkg.name}) with BidForm: ${bidForm.id}`);

            return {
              bidPackage,
              bidForm
            };
          })
        );

        // Filter out null values (empty packages)
        const validPackages = createdPackages.filter(p => p !== null);

        return NextResponse.json({
          ...result,
          createdPackages: validPackages,
          message: `Successfully created ${validPackages.length} bid packages with forms`
        });

      } catch (dbError) {
        console.error('Error saving to database:', dbError);
        // Return extraction result even if DB save fails
        return NextResponse.json({
          ...result,
          warning: 'Extraction successful but failed to save to database'
        });
      } finally {
        await prisma.$disconnect();
      }
    }

    // Return extraction result without saving to database
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract bid data' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;