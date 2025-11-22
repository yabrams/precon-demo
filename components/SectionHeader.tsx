'use client';

/**
 * SectionHeader Component
 * Amazon-inspired section header with teal accent color
 * Based on the "Arriving today" / "Arriving tomorrow" pattern
 */

import React from 'react';

interface SectionHeaderProps {
  title: string;
  variant?: 'teal' | 'default';
  className?: string;
}

export default function SectionHeader({
  title,
  variant = 'teal',
  className = '',
}: SectionHeaderProps) {
  const colorClass = variant === 'teal'
    ? 'text-[#067D7D]'
    : 'text-[#0F1111]';

  return (
    <h2 className={`text-[22px] font-bold leading-8 ${colorClass} ${className}`}>
      {title}
    </h2>
  );
}
