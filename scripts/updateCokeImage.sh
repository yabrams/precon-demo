#!/bin/bash

# Script to update Coca-Cola construction plan image
# Usage: ./updateCokeImage.sh <path-to-new-image>

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-image>"
  echo "Example: $0 ~/Downloads/coca-cola-plan.png"
  exit 1
fi

IMAGE_PATH="$1"

if [ ! -f "$IMAGE_PATH" ]; then
  echo "Error: Image file not found: $IMAGE_PATH"
  exit 1
fi

# Copy to uploads with clean name
cp "$IMAGE_PATH" public/uploads/coca-cola-level-01.png

echo "✓ Image copied to public/uploads/coca-cola-level-01.png"

# Process through extraction API
echo "Processing image through Claude API..."
npx tsx scripts/processCokeImage.ts public/uploads/coca-cola-level-01.png

echo "✓ Complete! Extracted data saved to lib/cokeExtractionData.json"
