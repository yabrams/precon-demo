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

// Color palette for highlighting - zinc palette for monochrome design
const HIGHLIGHT_COLORS = [
  '#71717a', // zinc-500
  '#a1a1aa', // zinc-400
  '#52525b', // zinc-600
  '#d4d4d8', // zinc-300
  '#27272a', // zinc-800
  '#3f3f46', // zinc-700
  '#18181b', // zinc-900
  '#a1a1aa', // zinc-400
  '#52525b', // zinc-600
  '#71717a', // zinc-500
];

// Glow colors for active boxes - zinc tones
const GLOW_COLORS: { [key: string]: string } = {
  '#71717a': '113, 113, 122',    // zinc-500
  '#a1a1aa': '161, 161, 170',    // zinc-400
  '#52525b': '82, 82, 91',       // zinc-600
  '#d4d4d8': '212, 212, 216',    // zinc-300
  '#27272a': '39, 39, 42',       // zinc-800
  '#3f3f46': '63, 63, 70',       // zinc-700
  '#18181b': '24, 24, 27',       // zinc-900
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
                  stroke="#ffffff"
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
