'use client';

/**
 * ProductCard Component
 * Amazon-inspired horizontal product card with image on left and content on right
 * Based on Amazon's order item card pattern
 */

import React from 'react';
import Image from 'next/image';

interface ProductCardProps {
  imageUrl?: string;
  imagePlaceholder?: React.ReactNode;
  title: string;
  titleLink?: boolean;
  onTitleClick?: () => void;
  subtitle?: string;
  metadata?: string[];
  actions?: React.ReactNode;
  className?: string;
}

export default function ProductCard({
  imageUrl,
  imagePlaceholder,
  title,
  titleLink = true,
  onTitleClick,
  subtitle,
  metadata = [],
  actions,
  className = '',
}: ProductCardProps) {
  return (
    <div className={`flex items-start space-x-5 py-5 ${className}`}>
      {/* Image/Icon Section */}
      <div className="flex-shrink-0 w-[100px] h-[100px] bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            width={100}
            height={100}
            className="object-contain w-full h-full"
          />
        ) : imagePlaceholder ? (
          imagePlaceholder
        ) : (
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        {titleLink && onTitleClick ? (
          <button
            onClick={onTitleClick}
            className="text-sm font-normal leading-5 text-[#007185] hover:text-[#C7511F] hover:underline transition-colors text-left block mb-2"
          >
            {title}
          </button>
        ) : (
          <h3 className="text-sm font-normal leading-5 text-[#0F1111] mb-2">
            {title}
          </h3>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="text-sm font-normal text-[#0F1111] mb-2">
            {subtitle}
          </p>
        )}

        {/* Metadata */}
        {metadata.length > 0 && (
          <div className="space-y-1 mb-4">
            {metadata.map((item, index) => (
              <p key={index} className="text-xs leading-4 text-[#0F1111]">
                {item}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        {actions && <div className="mt-4">{actions}</div>}
      </div>
    </div>
  );
}
