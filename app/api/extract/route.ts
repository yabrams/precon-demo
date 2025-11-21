import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

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

    let imageBuffer: ArrayBuffer;
    let contentType = 'image/jpeg';

    // Check if this is a local file path or remote URL
    if (imageUrl.startsWith('/uploads/')) {
      // Local file - read from disk
      const filepath = path.join(process.cwd(), 'public', imageUrl);
      const buffer = await readFile(filepath);
      imageBuffer = buffer.buffer;

      // Determine content type from file extension
      const ext = path.extname(imageUrl).toLowerCase();
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
    } else {
      // Remote URL - fetch it
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image');
      }
      imageBuffer = await imageResponse.arrayBuffer();
      contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    }

    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Determine media type from content-type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

    if (contentType.includes('png')) mediaType = 'image/png';
    else if (contentType.includes('gif')) mediaType = 'image/gif';
    else if (contentType.includes('webp')) mediaType = 'image/webp';

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
${instructions ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${instructions}\n` : ''}
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

    console.log('Extraction result:', JSON.stringify(result, null, 2));
    console.log('Line items count:', result.line_items?.length || 0);

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
