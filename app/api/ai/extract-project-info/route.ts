/**
 * AI Project Info Extraction API
 * Extracts comprehensive project information from uploaded construction documents
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ProjectInfoExtractionRequest {
  documentUrls: string[];
  documentNames: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ProjectInfoExtractionRequest = await request.json();
    const { documentUrls, documentNames } = body;

    if (!documentUrls || documentUrls.length === 0) {
      return NextResponse.json(
        { error: 'No documents provided' },
        { status: 400 }
      );
    }

    // Prepare image content for Claude Vision API
    const imageContents = await Promise.all(
      documentUrls.map(async (imageUrl, index) => {
        let imageData: string;
        let mediaType: string;

        if (imageUrl.startsWith('/uploads/')) {
          // Read local file
          const filepath = path.join(process.cwd(), 'public', imageUrl);
          const buffer = await readFile(filepath);
          imageData = buffer.toString('base64');
          
          // Determine media type from file extension
          const ext = path.extname(imageUrl).toLowerCase();
          mediaType = ext === '.png' ? 'image/png' : 
                     ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                     ext === '.webp' ? 'image/webp' : 
                     ext === '.gif' ? 'image/gif' : 
                     'application/pdf';
        } else {
          // Fetch remote URL
          const response = await fetch(imageUrl);
          const buffer = await response.arrayBuffer();
          imageData = Buffer.from(buffer).toString('base64');
          
          // Get media type from response headers
          const contentType = response.headers.get('content-type');
          mediaType = contentType?.startsWith('image/') || contentType === 'application/pdf'
            ? contentType
            : 'image/jpeg';
        }

        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
            data: imageData,
          },
        };
      })
    );

    // Construct AI prompt for project info extraction
    const documentList = documentNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
    
    const prompt = `You are analyzing construction project documents to extract comprehensive project information. I have provided ${documentUrls.length} document(s):

${documentList}

Please analyze these documents and extract as much of the following information as possible:

**Basic Information:**
- Project name
- Project number (if available)
- Description (comprehensive summary of the project scope)

**Location:**
- Full address
- City, State, ZIP code
- Country

**Timeline:**
- Bid due date (if mentioned)
- Project start date (if mentioned)
- Project end date / completion date (if mentioned)

**Project Details:**
- Estimated project value / budget (if mentioned)
- Market sector (e.g., Commercial, Healthcare, Education, Industrial, Residential)
- Project type (e.g., New Construction, Renovation, Addition)
- Building type (e.g., Office, Hospital, School, Warehouse, Multifamily)
- Estimated square footage (if mentioned)
- Number of floors (if mentioned)

**Parties Involved:**
- Owner name
- Architect name
- Engineer name
- General contractor (if already awarded)

**Additional Details:**
- Project phase (e.g., Bidding, Design, Construction)
- Funding type (e.g., Public, Private, Mixed)
- Delivery method (e.g., Design-Bid-Build, Design-Build, CM at Risk)
- Contract type (e.g., Lump Sum, Cost Plus, GMP)
- Any special requirements (bonding, prevailing wage, minority/women business goals, etc.)

**Bid Packages / Scope Categories:**
Identify distinct bid packages or scope categories mentioned in the documents. Common categories include:
- CONCRETE
- STRUCTURAL STEEL
- MEP (Mechanical, Electrical, Plumbing)
- SITE WORK
- ARCHITECTURAL FINISHES
- SPECIALTY ITEMS
- GENERAL REQUIREMENTS

For each bid package you identify, provide:
- Name (category)
- Description (brief scope description)
- Estimated budget (if mentioned)

Return your analysis as a JSON object with this structure:

{
  "projectInfo": {
    "name": "extracted name or null",
    "projectNumber": "extracted number or null",
    "description": "comprehensive description or null",
    "location": {
      "address": "string or null",
      "city": "string or null",
      "state": "string or null",
      "zipCode": "string or null",
      "country": "USA"
    },
    "bidDueDate": "ISO date string or null",
    "projectStartDate": "ISO date string or null",
    "projectEndDate": "ISO date string or null",
    "projectValue": number or null,
    "marketSector": "string or null",
    "projectType": "string or null",
    "buildingType": "string or null",
    "ownerName": "string or null",
    "architectName": "string or null",
    "engineerName": "string or null",
    "generalContractorName": "string or null",
    "estimatedSquareFootage": number or null,
    "numberOfFloors": number or null,
    "projectPhase": "string or null",
    "fundingType": "string or null",
    "deliveryMethod": "string or null",
    "contractType": "string or null",
    "bondingRequired": boolean or null,
    "prevailingWageRequired": boolean or null,
    "minorityBusinessGoal": number or null,
    "womenBusinessGoal": number or null
  },
  "bidPackages": [
    {
      "name": "CATEGORY NAME",
      "description": "scope description",
      "budgetAmount": number or null
    }
  ],
  "confidence": {
    "overall": number between 0-1,
    "reasoning": "explanation of confidence level"
  }
}

IMPORTANT: Return ONLY the JSON object, no additional text. Use null for any fields that cannot be determined from the documents.`;

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    let extractedData;
    try {
      // Try to parse as direct JSON
      extractedData = JSON.parse(content.text);
    } catch (e) {
      // Try to extract JSON from markdown code block
      const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find any JSON object in the response
        const objectMatch = content.text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          extractedData = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse JSON from Claude response');
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...extractedData,
    });
  } catch (error) {
    console.error('Project info extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract project information', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
