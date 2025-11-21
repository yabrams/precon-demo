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

// Color palette for highlighting - vibrant colors optimized for dark backgrounds
const HIGHLIGHT_COLORS = [
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#22d3ee', // cyan-400
];

// Glow colors for active boxes - softer tones for the shadow effect
const GLOW_COLORS: { [key: string]: string } = {
  '#8b5cf6': '139, 92, 246',    // violet
  '#06b6d4': '6, 182, 212',      // cyan
  '#10b981': '16, 185, 129',     // emerald
  '#f59e0b': '245, 158, 11',     // amber
  '#ec4899': '236, 72, 153',     // pink
  '#f97316': '249, 115, 22',     // orange
  '#6366f1': '99, 102, 241',     // indigo
  '#14b8a6': '20, 184, 166',     // teal
  '#a855f7': '168, 85, 247',     // purple
  '#22d3ee': '34, 211, 238',     // cyan-400
};

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

          const glowColor = GLOW_COLORS[color] || '139, 92, 246';

          return (
            <motion.g
              key={item.id || index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Glow effect for active bounding box (rendered first, behind the box) */}
              {isHovered && (
                <rect
                  x={pixelX - 4}
                  y={pixelY - 4}
                  width={pixelWidth + 8}
                  height={pixelHeight + 8}
                  fill="none"
                  stroke={color}
                  strokeWidth={8}
                  strokeOpacity={0.3}
                  filter={`url(#glow-${index})`}
                  className="pointer-events-none"
                />
              )}

              {/* Bounding box rectangle */}
              <rect
                x={pixelX}
                y={pixelY}
                width={pixelWidth}
                height={pixelHeight}
                fill={color}
                fillOpacity={isHovered ? 0.2 : 0}
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 0}
                strokeOpacity={isHovered ? 0.9 : 0}
                className="transition-all duration-200"
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 8px rgba(${glowColor}, 0.6))` : 'none'
                }}
                onMouseEnter={() => onHoverChange(item.id || null)}
                onMouseLeave={() => onHoverChange(null)}
              />

              {/* Subtle indicator when not hovered (small dot in corner) */}
              {!isHovered && (
                <circle
                  cx={pixelX + 8}
                  cy={pixelY + 8}
                  r={5}
                  fill={color}
                  fillOpacity={0.8}
                  stroke="#1e293b"
                  strokeWidth={2}
                  style={{
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    filter: `drop-shadow(0 0 4px rgba(${glowColor}, 0.5))`
                  }}
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
