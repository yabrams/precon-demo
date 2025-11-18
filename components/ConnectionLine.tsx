'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ConnectionLineProps {
  hoveredItemId: string | null;
  color: string;
  fromElement: HTMLElement | null;
  toX: number;
  toY: number;
}

export default function ConnectionLine({
  hoveredItemId,
  color,
  fromElement,
  toX,
  toY,
}: ConnectionLineProps) {
  const [fromPosition, setFromPosition] = useState({ x: 0, y: 0 });
  const [containerRect, setContainerRect] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!fromElement || !hoveredItemId) return;

    const updatePositions = () => {
      // Get the table row position
      const rect = fromElement.getBoundingClientRect();
      const container = document.querySelector('.workspace-container');
      const containerRect = container?.getBoundingClientRect();

      if (containerRect) {
        setFromPosition({
          x: rect.right - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top,
        });
        setContainerRect({
          width: containerRect.width,
          height: containerRect.height,
        });
      }
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [fromElement, hoveredItemId, toX, toY]);

  if (!hoveredItemId || !fromElement) {
    return null;
  }

  // Calculate control points for a smooth curved line
  const midX = (fromPosition.x + toX) / 2;
  const pathD = `M ${fromPosition.x} ${fromPosition.y} Q ${midX} ${fromPosition.y}, ${midX} ${(fromPosition.y + toY) / 2} T ${toX} ${toY}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{
        width: containerRect.width,
        height: containerRect.height,
        zIndex: 1000,
      }}
    >
      <AnimatePresence>
        <motion.path
          key="connection-line"
          d={pathD}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          exit={{ pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
        {/* Arrow head at the diagram end */}
        <motion.circle
          cx={toX}
          cy={toY}
          r={5}
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        />
      </AnimatePresence>
    </svg>
  );
}
