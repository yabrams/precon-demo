'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LineItem } from './BidFormTable';

interface DiagramOverlayProps {
  lineItems: LineItem[];
  hoveredItemId: string | null;
  onHoverChange: (itemId: string | null) => void;
  imageWidth: number;
  imageHeight: number;
}

// Color palette for highlighting - pastel colors with good contrast
const HIGHLIGHT_COLORS = [
  '#93c5fd', // blue-300
  '#fca5a5', // red-300
  '#86efac', // green-300
  '#fcd34d', // yellow-300
  '#c4b5fd', // violet-300
  '#fdba74', // orange-300
  '#f9a8d4', // pink-300
  '#67e8f9', // cyan-300
  '#d8b4fe', // purple-300
  '#a7f3d0', // emerald-300
];

export default function DiagramOverlay({
  lineItems,
  hoveredItemId,
  onHoverChange,
  imageWidth,
  imageHeight,
}: DiagramOverlayProps) {
  // Check if we have any items with bounding boxes
  const hasItemsWithBoxes = lineItems.some((item) => item.boundingBox);

  if (!hasItemsWithBoxes || imageWidth === 0 || imageHeight === 0) {
    return null;
  }

  const getColorForItem = (index: number): string => {
    return HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={imageWidth}
      height={imageHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <AnimatePresence>
        {lineItems.map((item, index) => {
          if (!item.boundingBox) return null;

          const { x, y, width, height } = item.boundingBox;
          const isHovered = hoveredItemId === item.id;

          // Convert normalized coordinates (0-1) to pixel coordinates
          const pixelX = x * imageWidth;
          const pixelY = y * imageHeight;
          const pixelWidth = width * imageWidth;
          const pixelHeight = height * imageHeight;

          const color = getColorForItem(index);

          return (
            <motion.g
              key={item.id || index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Bounding box rectangle */}
              <rect
                x={pixelX}
                y={pixelY}
                width={pixelWidth}
                height={pixelHeight}
                fill={color}
                fillOpacity={isHovered ? 0.4 : 0}
                stroke={color}
                strokeWidth={isHovered ? 3 : 0}
                strokeOpacity={isHovered ? 1 : 0}
                className="transition-all duration-200"
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onMouseEnter={() => onHoverChange(item.id || null)}
                onMouseLeave={() => onHoverChange(null)}
              />

              {/* Subtle indicator when not hovered (small dot in corner) */}
              {!isHovered && (
                <circle
                  cx={pixelX + 6}
                  cy={pixelY + 6}
                  r={4}
                  fill={color}
                  fillOpacity={0.6}
                  stroke="white"
                  strokeWidth={1}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverChange(item.id || null)}
                  onMouseLeave={() => onHoverChange(null)}
                />
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
