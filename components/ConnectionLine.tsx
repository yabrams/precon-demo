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

  // Determine which color to use - violet or cyan based on the passed color
  // If color is in violet/purple range, use violet, otherwise use cyan
  const isVioletish = color.includes('c4b5fd') || color.includes('d8b4fe') || color.includes('8b5cf6') || color.includes('a855f7') || color.includes('6366f1');
  const lineColor = isVioletish ? '#8b5cf6' : '#06b6d4'; // violet-500 or cyan-500
  const glowColor = isVioletish ? 'rgba(139, 92, 246, 0.5)' : 'rgba(6, 182, 212, 0.5)';

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{
        width: containerRect.width,
        height: containerRect.height,
        zIndex: 1000,
      }}
    >
      <defs>
        <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <AnimatePresence>
        {/* Glow layer */}
        <motion.path
          key="connection-line-glow"
          d={pathD}
          stroke={glowColor}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          filter="url(#line-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          exit={{ pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
        {/* Main line */}
        <motion.path
          key="connection-line"
          d={pathD}
          stroke={lineColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          exit={{ pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
        {/* Arrow head at the diagram end with glow */}
        <motion.circle
          cx={toX}
          cy={toY}
          r={6}
          fill={lineColor}
          stroke={glowColor}
          strokeWidth={3}
          filter="url(#line-glow)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        />
      </AnimatePresence>
    </svg>
  );
}
