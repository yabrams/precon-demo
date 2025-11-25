'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LineItem, BoundingBox } from './BidFormTable';

interface DiagramOverlayProps {
  lineItems: LineItem[];
  hoveredItemId: string | null;
  onHoverChange: (itemId: string | null) => void;
  imageWidth: number;
  imageHeight: number;
}

// Colors for different bounding box types
const CALLOUT_COLOR = '#2563eb'; // blue-600 for callout markers on diagram
const DESCRIPTION_COLOR = '#16a34a'; // green-600 for description text

// Get all bounding boxes for an item (supports both legacy single box and new array)
function getAllBoundingBoxes(item: LineItem): BoundingBox[] {
  const boxes: BoundingBox[] = [];

  // Add from boundingBoxes array if present
  if (item.boundingBoxes && item.boundingBoxes.length > 0) {
    boxes.push(...item.boundingBoxes);
  }

  // Add legacy single boundingBox if present and no array
  if (item.boundingBox && boxes.length === 0) {
    boxes.push({ ...item.boundingBox, type: 'description' });
  }

  return boxes;
}

export default function DiagramOverlay({
  lineItems,
  hoveredItemId,
  onHoverChange,
}: DiagramOverlayProps) {
  // Check if we have any items with bounding boxes
  const hasItemsWithBoxes = lineItems.some((item) =>
    item.boundingBox || (item.boundingBoxes && item.boundingBoxes.length > 0)
  );

  if (!hasItemsWithBoxes) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      <AnimatePresence>
        {lineItems.flatMap((item, itemIndex) => {
          const boxes = getAllBoundingBoxes(item);
          if (boxes.length === 0) return [];

          const isHovered = hoveredItemId === item.id;

          return boxes.map((box, boxIndex) => {
            const { x, y, width, height, type } = box;

            // Skip boxes with invalid coordinates (outside 0-1 range)
            if (x < 0 || x > 1 || y < 0 || y > 1 || x + width > 1.1 || y + height > 1.1) {
              return null;
            }

            // Use different colors based on type
            const color = type === 'callout' ? CALLOUT_COLOR : DESCRIPTION_COLOR;

            return (
              <motion.div
                key={`${item.id || itemIndex}-${boxIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute"
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${width * 100}%`,
                  height: `${height * 100}%`,
                  backgroundColor: isHovered ? `${color}40` : `${color}1A`,
                  border: `${isHovered ? 4 : 2}px solid ${color}`,
                  borderRadius: '4px',
                  boxShadow: isHovered
                    ? `0 0 20px ${color}CC, 0 0 40px ${color}66`
                    : `0 0 8px ${color}60`,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={() => onHoverChange(item.id || null)}
                onMouseLeave={() => onHoverChange(null)}
              />
            );
          });
        })}
      </AnimatePresence>
    </div>
  );
}
