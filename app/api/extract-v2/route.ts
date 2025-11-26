import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { isPDFFile, processPDFForExtraction } from '@/lib/pdf-utils';
import { searchCSICodes } from '@/lib/csi/csiLookup';
import { generateMockExtraction } from '@/lib/mockDataGenerator';

// Helper function to match a line item description to CSI codes using search
function matchLineItemToCSI(description: string, csiDivision?: string): { code: string; title: string } | null {
  if (!description || description.trim().length === 0) {
    return null;
  }

  // Search for CSI codes matching the description
  const searchOptions: any = {
    query: description,
    limit: 3,
    caseSensitive: false,
  };

  // If we have a CSI division hint, filter by it
  if (csiDivision && csiDivision !== '00') {
    searchOptions.divisions = [csiDivision];
  }

  const results = searchCSICodes(searchOptions);

  // Return the best match if found
  if (results.length > 0) {
    const bestMatch = results[0];
    return {
      code: bestMatch.code.code,
      title: bestMatch.code.title,
    };
  }

  return null;
}

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
    max_tokens: 8000,
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
            text: `Analyze this construction/preconstruction diagram or work drawing and extract ALL bid packages and items.
${contextNote ? `\nCONTEXT: ${contextNote}\n` : ''}
${userInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${userInstructions}\n` : ''}

CRITICAL: You MUST extract EVERY SINGLE numbered item visible in this document. Do not skip any items.

STEP 1: IDENTIFY ALL SECTIONS AND ITEMS
Look for:
- Numbered items (e.g., 2.1, 2.2, 3.1, 8.1, etc.)
- Section headers (e.g., "2. Partitions, Door, Glazing", "3. Millwork Notes", "8. Site Notes")
- Legend items or note callouts
- Any text that describes work to be done

Common document structures:
- Notes sections organized by number (2.x, 3.x, 4.x, etc.)
- CSI MasterFormat divisions (02-16)
- General notes or specifications

STEP 2: ORGANIZE INTO BID PACKAGES
Group items by their section or trade:
- If items are numbered (e.g., 2.1, 2.2), group them by the first number (all 2.x items together)
- Use the section header as the package name (e.g., "Partitions, Door, Glazing, Structural")
- If no clear sections exist, group by CSI division or create logical trade packages
- Map to CSI divisions when possible:
  * Division 02: Site Construction
  * Division 03: Concrete
  * Division 04: Masonry
  * Division 05: Metals
  * Division 06: Wood & Plastics
  * Division 07: Thermal & Moisture
  * Division 08: Doors & Windows
  * Division 09: Finishes
  * Division 10: Specialties
  * Division 11: Equipment
  * Division 12: Furnishings
  * Division 13: Special Construction
  * Division 14: Conveying
  * Division 15: Mechanical
  * Division 16: Electrical

STEP 3: EXTRACT EACH ITEM
For every item, extract:
- item_number: The exact number shown (e.g., "2.1", "8.3", "A1")
- description: The complete text describing the work
- quantity: Number if specified (can be null)
- unit: Unit of measurement if specified (LF, SF, EA, CY, etc.) (can be null)
- notes: Any additional specifications or context
- boundingBox: Approximate location on the image (normalized 0.0-1.0 coordinates)

Format your response as a JSON object:
{
  "project_name": "string or null (extracted from document header, title, or project identification)",
  "project_description": "string or null (1-2 sentence summary of the overall project scope and type)",
  "bid_packages": [
    {
      "name": "Section name or Division XX - Description",
      "csi_division": "XX" or "00" if unknown,
      "description": "Brief description of scope",
      "line_items": [
        {
          "item_number": "string",
          "description": "string (complete work description)",
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
1. Extract EVERY numbered item - do not skip any
2. Preserve the exact item numbers as they appear
3. Include complete descriptions - do not truncate
4. Group items logically by section or trade
5. If an item has no quantity/unit, that's OK - extract it anyway
6. If you see 20+ items, you should extract 20+ line items
7. Do not extract pricing information
8. Do not invent items that aren't there
9. Each item should appear exactly once in exactly one bid package`,
          },
        ],
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse JSON response
  let result;
  let jsonStr = '';
  try {

    if (responseText.includes('```json')) {
      // Extract JSON from markdown code fence
      const jsonStart = responseText.indexOf('```json') + 7; // '```json'.length = 7
      const jsonEnd = responseText.indexOf('```', jsonStart);

      if (jsonEnd === -1) {
        // No closing fence found, try to find the last complete JSON object
        const firstBrace = responseText.indexOf('{', jsonStart);
        if (firstBrace !== -1) {
          // Find the last closing brace
          const lastBrace = responseText.lastIndexOf('}');
          if (lastBrace > firstBrace) {
            jsonStr = responseText.substring(firstBrace, lastBrace + 1).trim();
          }
        }
      } else {
        jsonStr = responseText.substring(jsonStart, jsonEnd).trim();
      }
    } else if (responseText.includes('{')) {
      // Try to extract JSON directly
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      jsonStr = responseText.substring(jsonStart, jsonEnd).trim();
    }

    if (jsonStr) {
      result = JSON.parse(jsonStr);
      console.log('Successfully parsed JSON with', result.bid_packages?.length || 0, 'bid packages');
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (parseError: any) {
    console.error('JSON parse error:', parseError.message);
    console.error('Attempted to parse length:', jsonStr?.length, 'characters');

    // Try to repair truncated JSON
    try {
      let repairedJson = jsonStr;

      // If JSON is truncated mid-object, try to close it
      if (repairedJson && !repairedJson.trim().endsWith('}')) {
        console.log('Attempting to repair truncated JSON...');

        // Count open braces and brackets
        const openBraces = (repairedJson.match(/\{/g) || []).length;
        const closeBraces = (repairedJson.match(/\}/g) || []).length;
        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/\]/g) || []).length;

        // Remove any incomplete string at the end
        repairedJson = repairedJson.replace(/,?\s*"[^"]*$/, '');
        repairedJson = repairedJson.replace(/,?\s*\{[^}]*$/, '');

        // Close missing brackets and braces
        for (let i = 0; i < (openBrackets - closeBrackets); i++) {
          repairedJson += ']';
        }
        for (let i = 0; i < (openBraces - closeBraces); i++) {
          repairedJson += '}';
        }

        result = JSON.parse(repairedJson);
        console.log('Successfully repaired and parsed truncated JSON');
      } else {
        throw new Error('Could not repair JSON');
      }
    } catch (repairError: any) {
      console.error('Failed to repair JSON:', repairError.message);
      console.error('Response was likely truncated due to max_tokens limit');
      console.error('First 500 chars:', jsonStr?.substring(0, 500));
      console.error('Last 500 chars:', jsonStr?.substring(jsonStr.length - 500));

      result = {
        project_name: null,
        bid_packages: [{
          name: 'GENERAL',
          csi_division: '00',
          description: 'General bid items',
          line_items: []
        }],
        extraction_confidence: 'low',
        raw_text: responseText.substring(0, 1000), // Store first 1000 chars for debugging
        error: 'Response truncated - increase max_tokens'
      };
    }
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
    project_description: null as string | null,
    bid_packages: new Map<string, any>(),
    extraction_confidence: 'medium' as string,
    page_count: results.length
  };

  // Use the first non-null project name and description found
  for (const result of results) {
    if (result.project_name && !combined.project_name) {
      combined.project_name = result.project_name;
    }
    if (result.project_description && !combined.project_description) {
      combined.project_description = result.project_description;
    }
    if (combined.project_name && combined.project_description) {
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
    project_description: combined.project_description,
    bid_packages: packagesArray,
    extraction_confidence: combined.extraction_confidence,
    page_count: combined.page_count
  };
}

export async function POST(request: Request) {
  try {
    const { imageUrl, instructions, projectId, diagramId, useMockData } = await request.json();

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

    // If mock mode is enabled, generate mock data instead of calling Claude API
    if (useMockData) {
      console.log('Mock mode enabled - generating mock data instead of calling Claude API');

      // Generate mock bid packages (with 2 second delay to simulate API call)
      const mockResult = await generateMockExtraction(2000);

      console.log('Mock extraction complete:', JSON.stringify(mockResult, null, 2));
      console.log('Mock bid packages count:', mockResult.bid_packages?.length || 0);

      // Log total line items across all packages
      const totalLineItems = mockResult.bid_packages?.reduce((sum: number, pkg: any) =>
        sum + (pkg.line_items?.length || 0), 0) || 0;
      console.log('Total mock line items across all packages:', totalLineItems);

      // If projectId is provided, save mock data to database
      if (projectId && mockResult.bid_packages && mockResult.bid_packages.length > 0) {
        try {
          // Create bid packages and forms for each mock package
          const createdPackages = await Promise.all(
            mockResult.bid_packages.map(async (pkg: any) => {
              // Check if package has any line items
              if (!pkg.line_items || pkg.line_items.length === 0) {
                console.log(`Skipping empty mock package: ${pkg.name}`);
                return null;
              }

              // Create the bid package
              const bidPackage = await prisma.bidPackage.create({
                data: {
                  bcBidPackageId: `${projectId}-${pkg.csi_division}-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                  bcProjectId: projectId,
                  name: pkg.name,
                  description: pkg.description || `${pkg.name} scope of work (MOCK DATA)`,
                  scope: pkg.description,
                  status: 'draft',
                  progress: 0,
                  diagramIds: diagramId ? JSON.stringify([diagramId]) : null,
                }
              });

              // Create bid form with mock line items for this package
              const lineItemsForDB = pkg.line_items.map((item: any, index: number) => ({
                itemNumber: item.item_number || null,
                description: item.description,
                quantity: item.quantity || null,
                unit: item.unit || null,
                unitPrice: item.unit_price || null,
                totalPrice: item.total_price || null,
                notes: item.notes || null,
                order: index,
                verified: false,
                csiCode: item.csiCode || 'N/A',
                csiTitle: item.csiTitle || 'N/A',
              }));

              const bidForm = await prisma.bidForm.create({
                data: {
                  bidPackageId: bidPackage.id,
                  diagramId: diagramId || null,
                  extractionConfidence: mockResult.extraction_confidence || 'medium',
                  rawExtractedText: 'MOCK DATA GENERATED',
                  status: 'draft',
                  lineItems: {
                    create: lineItemsForDB
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

              console.log(`Created Mock BidPackage: ${bidPackage.id} (${pkg.name}) with BidForm: ${bidForm.id}`);

              return {
                bidPackage,
                bidForm
              };
            })
          );

          // Filter out null values (empty packages)
          const validPackages = createdPackages.filter(p => p !== null);

          return NextResponse.json({
            ...mockResult,
            createdPackages: validPackages,
            message: `Successfully created ${validPackages.length} mock bid packages with forms`,
            isMockData: true
          });

        } catch (dbError) {
          console.error('Error saving mock data to database:', dbError);
          // Return mock extraction result even if DB save fails
          return NextResponse.json({
            ...mockResult,
            warning: 'Mock extraction successful but failed to save to database',
            isMockData: true
          });
        }
      }

      // Return mock extraction result without saving to database
      return NextResponse.json({
        ...mockResult,
        isMockData: true
      });
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

    // Log details of each package
    if (combinedResult.bid_packages && combinedResult.bid_packages.length > 0) {
      console.log('\n========== EXTRACTION RESULTS ==========');
      combinedResult.bid_packages.forEach((pkg: any, idx: number) => {
        console.log(`\nPackage ${idx + 1}: ${pkg.name}`);
        console.log(`  CSI Division: ${pkg.csi_division}`);
        console.log(`  Description: ${pkg.description}`);
        console.log(`  Line Items Count: ${pkg.line_items?.length || 0}`);

        if (pkg.line_items && pkg.line_items.length > 0) {
          pkg.line_items.forEach((item: any, itemIdx: number) => {
            console.log(`    ${itemIdx + 1}. [${item.item_number || 'N/A'}] ${item.description?.substring(0, 60)}...`);
          });
        } else {
          console.log('    (No line items)');
        }
      });
      console.log('\n========================================\n');
    }

    // Apply CSI matching to all line items in the extraction result
    // This ensures CSI codes are always populated, regardless of whether we're saving to DB
    if (combinedResult.bid_packages && Array.isArray(combinedResult.bid_packages)) {
      combinedResult.bid_packages = combinedResult.bid_packages.map((pkg: any) => {
        if (pkg.line_items && Array.isArray(pkg.line_items)) {
          pkg.line_items = pkg.line_items.map((item: any) => {
            const csiMatch = matchLineItemToCSI(item.description, pkg.csi_division);
            return {
              ...item,
              csiCode: csiMatch?.code || 'N/A',
              csiTitle: csiMatch?.title || 'N/A',
            };
          });
        }
        return pkg;
      });
    }

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
            // CSI codes are already computed above, so we just use them
            const lineItemsForDB = pkg.line_items.map((item: any, index: number) => ({
              itemNumber: item.item_number || null,
              description: item.description,
              quantity: item.quantity || null,
              unit: item.unit || null,
              unitPrice: item.unit_price || null,
              totalPrice: item.total_price || null,
              notes: item.notes || null,
              order: index,
              verified: false,
              csiCode: item.csiCode || 'N/A',
              csiTitle: item.csiTitle || 'N/A',
            }));

            const bidForm = await prisma.bidForm.create({
              data: {
                bidPackageId: bidPackage.id,
                diagramId: diagramId || null,
                extractionConfidence: result.extraction_confidence || 'unknown',
                rawExtractedText: result.raw_text || null,
                status: 'draft',
                lineItems: {
                  create: lineItemsForDB
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