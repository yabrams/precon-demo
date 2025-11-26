import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/ai/categorize-document
 * Use Claude Vision to analyze a document and suggest bid package category
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, fileName, fileType } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    let imageData: Buffer;
    let mediaType: string;

    // Handle local uploads vs remote URLs
    if (imageUrl.startsWith('/uploads/')) {
      // Read from local filesystem
      const filepath = path.join(process.cwd(), 'public', imageUrl);
      imageData = await readFile(filepath);

      // Determine media type from file extension
      const ext = imageUrl.toLowerCase().split('.').pop();
      mediaType = ext === 'png' ? 'image/png' :
                  ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                  ext === 'webp' ? 'image/webp' :
                  ext === 'gif' ? 'image/gif' : 'image/jpeg';
    } else {
      // Fetch from remote URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageData = Buffer.from(arrayBuffer);

      // Get media type from response or default
      mediaType = response.headers.get('content-type') || 'image/jpeg';
    }

    const base64Image = imageData.toString('base64');

    // Create categorization prompt
    const prompt = `You are an expert construction document analyzer. Analyze this construction document and categorize it into the most appropriate bid package category.

Available categories:
1. STRUCTURAL STEEL - Steel framing, beams, columns, connections
2. CONCRETE - Concrete work, formwork, reinforcement, finishing
3. MEP (Mechanical, Electrical, Plumbing) - HVAC, electrical systems, plumbing, fire protection
4. SITE WORK - Excavation, grading, utilities, paving, landscaping
5. ARCHITECTURAL FINISHES - Drywall, painting, flooring, ceilings, doors, windows
6. SPECIALTY ITEMS - Elevators, special equipment, unique systems
7. GENERAL REQUIREMENTS - Safety, temporary facilities, project management

Analyze the document content, including:
- Document title and headers
- Type of technical drawings or specifications
- Materials and systems depicted
- Trade-specific terminology and details
- Construction phases and scope

Respond with a JSON object (no markdown, just JSON) with this structure:
{
  "category": "CATEGORY_NAME",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategories": ["CATEGORY_2", "CATEGORY_3"]
}

The confidence should be a number between 0 and 1, where:
- 0.9-1.0: Very confident, clear indicators
- 0.7-0.9: Confident, some supporting evidence
- 0.5-0.7: Moderate confidence, could be multiple categories
- Below 0.5: Low confidence, ambiguous document

Provide alternative categories if the document could reasonably fit multiple categories.

File name: ${fileName || 'Unknown'}
File type: ${fileType || 'Unknown'}`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as any,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    // Extract text response
    const textContent = message.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    if (!textContent) {
      throw new Error('No text content in Claude response');
    }

    let responseText = textContent.text.trim();

    // Parse JSON from response (handle markdown code blocks)
    let categorization;
    try {
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\n?/g, '');
      }

      categorization = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      throw new Error('Failed to parse AI response');
    }

    // Validate response structure
    if (!categorization.category || typeof categorization.confidence !== 'number') {
      throw new Error('Invalid categorization response structure');
    }

    return NextResponse.json({
      category: categorization.category,
      confidence: categorization.confidence,
      reasoning: categorization.reasoning || 'No reasoning provided',
      alternativeCategories: categorization.alternativeCategories || [],
      rawResponse: responseText
    });

  } catch (error) {
    console.error('Error categorizing document:', error);
    return NextResponse.json(
      {
        error: 'Failed to categorize document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
