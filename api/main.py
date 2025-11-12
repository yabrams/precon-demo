from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv
import base64

load_dotenv()

app = FastAPI(title="Preconstruction Bidding API")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class LineItem(BaseModel):
    item_number: Optional[str] = None
    description: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    notes: Optional[str] = None

class BidFormResponse(BaseModel):
    project_name: Optional[str] = None
    line_items: List[LineItem]
    extraction_confidence: str
    raw_text: Optional[str] = None

class VerificationRequest(BaseModel):
    bid_form_id: str
    verified_items: List[str]
    comments: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Preconstruction Bidding API", "status": "running"}

@app.post("/api/extract-bid", response_model=BidFormResponse)
async def extract_bid_from_diagram(file: UploadFile = File(...)):
    """
    Extract bid form data from uploaded diagram using Claude Vision API
    """
    try:
        # Read file content
        content = await file.read()

        # Get API key
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=api_key)

        # Encode image to base64
        image_data = base64.standard_b64encode(content).decode("utf-8")

        # Determine media type
        media_type = "image/jpeg"
        if file.filename:
            if file.filename.lower().endswith('.png'):
                media_type = "image/png"
            elif file.filename.lower().endswith('.jpg') or file.filename.lower().endswith('.jpeg'):
                media_type = "image/jpeg"
            elif file.filename.lower().endswith('.webp'):
                media_type = "image/webp"
            elif file.filename.lower().endswith('.gif'):
                media_type = "image/gif"

        # Create message with vision
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": """Analyze this construction/preconstruction diagram or work drawing and extract all bid items and information.

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

If this is not a construction diagram or you cannot extract meaningful bid information, return an empty line_items array and set extraction_confidence to "low"."""
                        }
                    ],
                }
            ],
        )

        # Extract text response
        response_text = message.content[0].text

        # Parse JSON response
        import json
        try:
            # Try to extract JSON from response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
            elif "{" in response_text:
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                json_str = response_text[json_start:json_end]
            else:
                json_str = response_text

            result = json.loads(json_str)
            return BidFormResponse(**result, raw_text=response_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, return raw text
            return BidFormResponse(
                line_items=[],
                extraction_confidence="low",
                raw_text=response_text
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
