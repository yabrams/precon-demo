'use client';

/**
 * OrderSummaryCard Component
 * Amazon-inspired summary card with key-value pairs in a grid layout
 * Based on the "ORDER PLACED / TOTAL / SHIP TO" pattern
 */

import React from 'react';

export interface SummaryField {
  label: string;
  value: string | React.ReactNode;
  isLink?: boolean;
  onClick?: () => void;
}

interface OrderSummaryCardProps {
  fields: SummaryField[];
  className?: string;
}

export default function OrderSummaryCard({
  fields,
  className = '',
}: OrderSummaryCardProps) {
  return (
    <div className={`bg-[#F0F2F2] rounded-lg p-5 ${className}`}>
      <div className={`grid gap-8 ${fields.length === 3 ? 'grid-cols-3' : fields.length === 4 ? 'grid-cols-4' : fields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {fields.map((field, index) => (
          <div key={index} className="flex flex-col">
            <span className="text-xs font-bold text-[#565959] uppercase tracking-tight mb-1.5">
              {field.label}
            </span>
            {field.isLink && field.onClick ? (
              <button
                onClick={field.onClick}
                className="text-sm font-normal text-[#007185] hover:text-[#C7511F] hover:underline transition-colors flex items-center text-left"
              >
                {field.value}
                <svg
                  className="h-4 w-4 ml-1.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            ) : (
              <span className="text-sm font-normal text-[#0F1111]">
                {field.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
