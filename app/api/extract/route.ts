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
            text: `Analyze this construction/preconstruction diagram or work drawing and extract all bid items and information.
${contextNote ? `\nCONTEXT: ${contextNote}\n` : ''}
${userInstructions ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${userInstructions}\n` : ''}
Please extract the following information in a structured format:
1. Project name or title (if visible)
2. All line items with:
   - Item number (if present)
   - Description of work/material
   - Quantity (if specified)
   - Unit of measurement (e.g., LF, SF, EA, CY, etc.)
   - Any relevant notes or specifications
   - IMPORTANT: The bounding box coordinates of where this item appears in the diagram

NOTE: Do not extract pricing information (unit prices or totals). This is a quantity takeoff only.

For bounding boxes, provide normalized coordinates (0.0 to 1.0 range) relative to the image dimensions:
- x: horizontal position of the left edge (0 = left edge, 1 = right edge)
- y: vertical position of the top edge (0 = top edge, 1 = bottom edge)
- width: horizontal span (as a fraction of total width)
- height: vertical span (as a fraction of total height)

If an item appears in multiple locations, use the primary or most prominent location. If you cannot determine the location with reasonable confidence, set boundingBox to null for that item.

Format your response as a JSON object with this structure:
{
  "project_name": "string or null",
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
        raw_text: responseText,
      };
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Response text:', responseText);
    result = {
      project_name: null,
      line_items: [],
      extraction_confidence: 'low',
      raw_text: responseText,
    };
  }

  return result;
}

// Helper function to combine extraction results from multiple pages
function combineExtractionResults(results: any[]) {
  if (results.length === 0) {
    return {
      project_name: null,
      line_items: [],
      extraction_confidence: 'low'
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  // Combine results from multiple pages
  const combined = {
    project_name: null as string | null,
    line_items: [] as any[],
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

  // Combine all line items, adding page number info
  for (const result of results) {
    if (result.line_items && Array.isArray(result.line_items)) {
      const pageNumber = result.pageNumber || 1;
      result.line_items.forEach((item: any) => {
        combined.line_items.push({
          ...item,
          source_page: pageNumber,
          notes: item.notes ? `${item.notes} (Page ${pageNumber})` : `Page ${pageNumber}`
        });
      });
    }
  }

  // Determine overall confidence
  const confidenceLevels = results.map(r => r.extraction_confidence || 'low');
  if (confidenceLevels.every(c => c === 'high')) {
    combined.extraction_confidence = 'high';
  } else if (confidenceLevels.some(c => c === 'low')) {
    combined.extraction_confidence = 'low';
  }

  return combined;
}

export async function POST(request: Request) {
  try {
    const { imageUrl, instructions, bidPackageId, diagramId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL provided' },
        { status: 400 }
      );
    }

    // If bidPackageId is provided, verify it exists
    if (bidPackageId) {
      const bidPackage = await prisma.bidPackage.findUnique({
        where: { id: bidPackageId }
      });

      if (!bidPackage) {
        return NextResponse.json(
          { error: 'Bid package not found' },
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
    console.log('Line items count:', combinedResult.line_items?.length || 0);

    const result = combinedResult;

    // If bidPackageId is provided, create BidForm and save line items to database
    if (bidPackageId && result.line_items && result.line_items.length > 0) {
      try {
        const bidForm = await prisma.bidForm.create({
          data: {
            bidPackageId,
            diagramId: diagramId || null,
            extractionConfidence: result.extraction_confidence || 'unknown',
            rawExtractedText: result.raw_text || null,
            status: 'draft',
            lineItems: {
              create: result.line_items.map((item: any, index: number) => ({
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

        console.log('Created BidForm:', bidForm.id);

        return NextResponse.json({
          ...result,
          bidFormId: bidForm.id,
          bidForm: bidForm
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
