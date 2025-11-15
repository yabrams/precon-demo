import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function processCokeImage(imagePath: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const client = new Anthropic({ apiKey });

  // Read the image
  const resolvedPath = imagePath.startsWith('/')
    ? imagePath
    : join(process.cwd(), imagePath);
  const imageBuffer = readFileSync(resolvedPath);
  const base64Image = imageBuffer.toString('base64');

  // Determine media type
  const ext = imagePath.toLowerCase();
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
  if (ext.includes('.jpg') || ext.includes('.jpeg')) mediaType = 'image/jpeg';
  else if (ext.includes('.gif')) mediaType = 'image/gif';
  else if (ext.includes('.webp')) mediaType = 'image/webp';

  const extractionPrompt = `You are analyzing a construction diagram to extract bid line items.

Carefully examine this construction diagram and extract all bid line items with their details.

For each line item, extract:
- item_number: The reference number (e.g., "2.5", "3.4")
- description: Full description of the work item
- quantity: Numerical quantity (if specified, otherwise null)
- unit: Unit of measurement (SF, LF, EA, LS, etc., otherwise null)
- unit_price: Price per unit (if specified, otherwise null)
- total_price: Total price (if specified, otherwise null)
- notes: Any additional notes or references
- boundingBox: Location on the diagram where this item is marked (x, y, width, height as percentages from 0-1)

Return ONLY a valid JSON object in this exact format:
{
  "project_name": "Project name from diagram",
  "line_items": [
    {
      "item_number": "1.0",
      "description": "Work description",
      "quantity": null,
      "unit": null,
      "unit_price": null,
      "total_price": null,
      "notes": "Any notes",
      "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.05, "height": 0.02}
    }
  ],
  "extraction_confidence": "high" | "medium" | "low"
}`;

  console.log('Calling Claude API...');
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [{
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
          text: extractionPrompt,
        },
      ],
    }],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response
  let jsonContent = responseText;
  if (responseText.includes('```json')) {
    const jsonStart = responseText.indexOf('```json') + 7;
    const jsonEnd = responseText.indexOf('```', jsonStart);
    jsonContent = responseText.substring(jsonStart, jsonEnd).trim();
  } else if (responseText.includes('{')) {
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;
    jsonContent = responseText.substring(jsonStart, jsonEnd);
  }

  const extracted = JSON.parse(jsonContent);

  console.log('Extraction complete!');
  console.log(`Project: ${extracted.project_name}`);
  console.log(`Line items: ${extracted.line_items?.length || 0}`);
  console.log(`Confidence: ${extracted.extraction_confidence}`);

  return extracted;
}

// Get image path from command line
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: tsx processCokeImage.ts <image-path>');
  process.exit(1);
}

processCokeImage(imagePath)
  .then(data => {
    const outputPath = join(__dirname, '../lib/cokeExtractionData.json');
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nSaved to: ${outputPath}`);
    console.log('\nFirst few items:');
    data.line_items.slice(0, 3).forEach((item: any) => {
      console.log(`  ${item.item_number}: ${item.description}`);
    });
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
