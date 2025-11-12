import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL provided' },
        { status: 400 }
      );
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

Please extract the following information in a structured format:
1. Project name or title (if visible)
2. All line items with:
   - Item number (if present)
   - Description of work/material
   - Quantity (if specified)
   - Unit of measurement (e.g., LF, SF, EA, CY, etc.)
   - Any visible pricing information
   - Any relevant notes or specifications

Format your response as a JSON object with this structure:
{
  "project_name": "string or null",
  "line_items": [
    {
      "item_number": "string or null",
      "description": "string",
      "quantity": number or null,
      "unit": "string or null",
      "unit_price": number or null,
      "total_price": number or null,
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
