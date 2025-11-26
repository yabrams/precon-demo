'use client';

/**
 * SectionHeader Component
 * Section header with zinc accent color
 */

import React from 'react';

interface SectionHeaderProps {
  title: string;
  variant?: 'teal' | 'default';
  className?: string;
}

export default function SectionHeader({
  title,
  variant = 'default',
  className = '',
}: SectionHeaderProps) {
  // Both variants now use zinc-900 for consistency
  const colorClass = 'text-zinc-900';

  return (
    <h2 className={`text-[22px] font-bold leading-8 ${colorClass} ${className}`}>
      {title}
    </h2>
  );
}
