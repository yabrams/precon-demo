import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';
import { ChatRequest, ChatResponse, ProposedChange } from '@/types/chat';

export async function POST(request: Request) {
  try {
    const {
      message,
      imageUrl,
      currentLineItems,
      projectName,
      conversationHistory,
    }: ChatRequest = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Load image if available
    let imageBuffer: ArrayBuffer | null = null;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

    if (imageUrl) {
      try {
        if (imageUrl.startsWith('/uploads/')) {
          // Local file
          const filepath = path.join(process.cwd(), 'public', imageUrl);
          const buffer = await readFile(filepath);
          imageBuffer = buffer.buffer;

          const ext = path.extname(imageUrl).toLowerCase();
          if (ext === '.png') mediaType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') mediaType = 'image/jpeg';
          else if (ext === '.gif') mediaType = 'image/gif';
          else if (ext === '.webp') mediaType = 'image/webp';
        } else {
          // Remote URL
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            imageBuffer = await imageResponse.arrayBuffer();
            const contentType = imageResponse.headers.get('content-type') || '';
            if (contentType.includes('png')) mediaType = 'image/png';
            else if (contentType.includes('gif')) mediaType = 'image/gif';
            else if (contentType.includes('webp')) mediaType = 'image/webp';
          }
        }
      } catch (error) {
        console.error('Error loading image:', error);
        // Continue without image
      }
    }

    // Analyze conversation history to determine context
    const lastAssistantMessage = conversationHistory?.slice().reverse().find(m => m.role === 'assistant');
    const isConfirmingPreviousUpdate = lastAssistantMessage?.content.includes('Would you like me to proceed') ||
                                        lastAssistantMessage?.content.includes('confirm') ||
                                        lastAssistantMessage?.content.includes('Shall I go ahead');

    // Check if user is confirming
    const confirmationKeywords = ['yes', 'confirm', 'proceed', 'go ahead', 'do it', 'please', 'sure', 'ok', 'okay'];
    const isUserConfirming = isConfirmingPreviousUpdate &&
                             confirmationKeywords.some(keyword => message.toLowerCase().includes(keyword));

    // Build conversation context
    let contextPrompt = `You are an AI assistant helping with a preconstruction bidding project.

Project: ${projectName}
Current bid items count: ${currentLineItems.length}

IMPORTANT: This bid form is for quantity takeoff only. Pricing information (unit_price and total_price) is NOT displayed or used.

Current line items in the bid form:
${JSON.stringify(currentLineItems, null, 2)}

`;

    if (isUserConfirming) {
      // User is confirming a previous update request - generate the actual proposed changes
      contextPrompt += `CONTEXT: The user has confirmed they want to proceed with the update you previously described.

User's confirmation: ${message}

Based on the conversation history and your previous description of the update, now generate the specific changes to implement.

Return your response in this JSON format:
{
  "response": "A brief confirmation message about what you're updating",
  "proposedChanges": [
    {
      "type": "add",
      "newItem": {
        "id": "a3X9k2",
        "item_number": "2.1",
        "description": "New item description",
        "quantity": 4,
        "unit": "EA",
        "notes": "Optional notes"
      }
    },
    {
      "type": "update",
      "itemId": "existing-item-id",
      "newItem": {
        "id": "existing-item-id",
        "description": "updated description",
        "quantity": 1,
        "unit": "updated unit",
        "notes": "updated notes"
      },
      "changes": [
        { "field": "quantity", "oldValue": 5, "newValue": 1 },
        { "field": "unit", "oldValue": "SF", "newValue": "updated unit" }
      ]
    },
    {
      "type": "delete",
      "itemId": "item-id-to-delete"
    }
  ]
}

CRITICAL REQUIREMENTS:
- For type "add": MUST include "newItem" with fields (id, item_number, description, quantity, unit, notes). Do NOT include unit_price or total_price. Generate unique ID using 6 random alphanumeric characters (e.g., "a3X9k2")
- For type "update": MUST include "itemId" (existing item ID), "newItem" (complete updated item), AND "changes" array
- The "changes" array MUST list every field that changed with oldValue and newValue
- For type "delete": include only "itemId"
- Do NOT include unit_price or total_price in any changes - these fields are not used
- Return ONLY valid JSON, no markdown code blocks or additional text`;
    } else {
      // Analyze the user's message to determine intent
      contextPrompt += `User's message: ${message}

INSTRUCTIONS:
1. Analyze if the user's message is:
   a) A QUESTION about the diagram, bid form, or project (asking for information, clarification, or explanation)
   b) An UPDATE REQUEST to modify the bid form (asking to change, add, delete, or update line items)

2. If it's a QUESTION:
   - Provide a clear, helpful answer based on the diagram and current bid form data
   - Return a simple text response

3. If it's an UPDATE REQUEST:
   - DO NOT generate proposed changes yet
   - Instead, ask the user to confirm they want to proceed
   - Explain clearly what will be changed and how many items will be affected
   - Ask: "Would you like me to proceed with this update?" or similar
   - Return a simple text response with your confirmation question

Examples:
- "What materials are in the bid?" → QUESTION → Answer directly
- "Set all quantities to 1" → UPDATE REQUEST → Ask for confirmation first
- "Add a new line item for concrete" → UPDATE REQUEST → Ask for confirmation first
- "How many line items do we have?" → QUESTION → Answer directly

Respond appropriately based on your analysis.`;
    }

    // Prepare message content
    const messageContent: any[] = [];

    // Add image if available (only on first message with image)
    if (imageBuffer && (!conversationHistory || conversationHistory.length === 0)) {
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Image,
        },
      });
    }

    // Add text prompt
    messageContent.push({
      type: 'text',
      text: contextPrompt,
    });

    // Build messages array with conversation history
    const messages: any[] = [];

    // Add conversation history (exclude system acknowledgments)
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory
        .filter(msg => !msg.content.startsWith('✅') && !msg.content.startsWith('❌'))
        .forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: messageContent,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: messages,
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse response - try JSON first, fall back to plain text
    let result: ChatResponse;

    // Check if response looks like JSON (for confirmed updates)
    if (responseText.trim().startsWith('{') || responseText.includes('```json')) {
      try {
        let jsonContent = responseText;

        // Extract JSON if wrapped in code blocks
        if (responseText.includes('```json')) {
          const jsonStart = responseText.indexOf('```json') + 7;
          const jsonEnd = responseText.indexOf('```', jsonStart);
          jsonContent = responseText.substring(jsonStart, jsonEnd).trim();
        } else if (responseText.includes('{')) {
          const jsonStart = responseText.indexOf('{');
          const jsonEnd = responseText.lastIndexOf('}') + 1;
          jsonContent = responseText.substring(jsonStart, jsonEnd);
        }

        const parsed = JSON.parse(jsonContent);
        console.log('Parsed JSON from Claude:', JSON.stringify(parsed, null, 2));
        result = {
          response: parsed.response || responseText,
          proposedChanges: parsed.proposedChanges || [],
        };
        console.log('Proposed changes count:', result.proposedChanges?.length);
        if (result.proposedChanges && result.proposedChanges.length > 0) {
          console.log('First change:', JSON.stringify(result.proposedChanges[0], null, 2));
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response text:', responseText);
        // Fallback to conversational response
        result = {
          response: responseText,
          proposedChanges: [],
        };
      }
    } else {
      // Plain text response (question answer or confirmation request)
      result = {
        response: responseText,
        proposedChanges: [],
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
