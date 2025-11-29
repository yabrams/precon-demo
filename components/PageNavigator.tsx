/**
 * PageNavigator Component
 *
 * Compact page navigation bar for multi-page documents.
 * Shows page numbers as clickable pills with visual indicators
 * for page type, classification confidence, and extraction status.
 */

'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageType, ProcessedPage } from '@/lib/pdf-utils';
import { PageClassification } from '@/lib/extraction/page-classifier';

// ============================================================================
// TYPES
// ============================================================================

export type PageStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export interface PageInfo {
  pageNumber: number;
  sheetNumber?: string;
  pageType: PageType;
  trade?: string;
  confidence: number;
  status?: PageStatus;
}

export interface PageNavigatorProps {
  /** Total number of pages */
  totalPages: number;
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Page classifications for visual indicators */
  pages?: PageInfo[];
  /** Called when a page is selected */
  onPageChange: (pageNumber: number) => void;
  /** Show trade color coding */
  showTradeColors?: boolean;
  /** Compact mode with smaller pills */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// TRADE COLORS
// ============================================================================

const TRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Mechanical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  Electrical: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  Plumbing: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'Fire Protection': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  Structural: { bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-400' },
  Architectural: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  Civil: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  Communications: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  General: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  default: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
};

function getTradeColors(trade?: string) {
  return TRADE_COLORS[trade || 'default'] || TRADE_COLORS.default;
}

// ============================================================================
// STATUS INDICATORS
// ============================================================================

function getStatusRing(status?: PageStatus): string {
  switch (status) {
    case 'completed':
      return 'ring-2 ring-green-400 ring-offset-1';
    case 'processing':
      return 'ring-2 ring-blue-400 ring-offset-1 animate-pulse';
    case 'failed':
      return 'ring-2 ring-red-400 ring-offset-1';
    case 'pending':
      return 'ring-1 ring-gray-300';
    default:
      return '';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PageNavigator({
  totalPages,
  currentPage,
  pages,
  onPageChange,
  showTradeColors = true,
  compact = false,
  className = '',
}: PageNavigatorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Build page info array
  const pageInfos = useMemo((): PageInfo[] => {
    if (pages && pages.length === totalPages) {
      return pages;
    }
    // Generate default page info
    return Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      pageType: 'plan' as PageType,
      confidence: 0.5,
    }));
  }, [pages, totalPages]);

  // Auto-scroll to keep active page visible
  useEffect(() => {
    if (activeButtonRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const button = activeButtonRef.current;

      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      const isVisible =
        buttonRect.left >= containerRect.left && buttonRect.right <= containerRect.right;

      if (!isVisible) {
        const scrollLeft =
          button.offsetLeft -
          container.offsetWidth / 2 +
          button.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [currentPage]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  // Scroll handlers for arrow buttons
  const handleScrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const handleScrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  // Pill size based on compact mode
  const pillClasses = compact
    ? 'min-w-[24px] h-6 px-1 text-xs'
    : 'min-w-[32px] h-8 px-2 text-sm';

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Prev button */}
      <button
        onClick={handlePrev}
        disabled={currentPage === 1}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        title="Previous page"
      >
        <ChevronLeft className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>

      {/* Scroll left indicator */}
      {totalPages > 15 && (
        <button
          onClick={handleScrollLeft}
          className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
          title="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Page pills container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto scrollbar-hide flex items-center space-x-1 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {pageInfos.map((pageInfo) => {
          const isActive = pageInfo.pageNumber === currentPage;
          const tradeColors = showTradeColors
            ? getTradeColors(pageInfo.trade)
            : getTradeColors();
          const statusRing = getStatusRing(pageInfo.status);

          // Determine label: sheet number or page number
          const label = pageInfo.sheetNumber || pageInfo.pageNumber.toString();

          // Confidence indicator (subtle opacity)
          const opacityClass =
            pageInfo.confidence >= 0.8
              ? 'opacity-100'
              : pageInfo.confidence >= 0.5
              ? 'opacity-90'
              : 'opacity-75';

          return (
            <button
              key={pageInfo.pageNumber}
              ref={isActive ? activeButtonRef : undefined}
              onClick={() => onPageChange(pageInfo.pageNumber)}
              className={`
                ${pillClasses}
                flex items-center justify-center
                rounded-md font-medium
                transition-all duration-150
                ${opacityClass}
                ${statusRing}
                ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : `${tradeColors.bg} ${tradeColors.text} hover:opacity-80 border ${tradeColors.border}`
                }
              `}
              title={`Page ${pageInfo.pageNumber}${
                pageInfo.sheetNumber ? ` (${pageInfo.sheetNumber})` : ''
              }${pageInfo.trade ? ` - ${pageInfo.trade}` : ''}`}
            >
              {label.length > 6 ? label.slice(0, 6) : label}
            </button>
          );
        })}
      </div>

      {/* Scroll right indicator */}
      {totalPages > 15 && (
        <button
          onClick={handleScrollRight}
          className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
          title="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        title="Next page"
      >
        <ChevronRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>

      {/* Page counter */}
      <span className="text-xs text-gray-500 flex-shrink-0 min-w-[60px] text-right">
        {currentPage} / {totalPages}
      </span>
    </div>
  );
}

// ============================================================================
// UTILITY: Convert ProcessedPage and PageClassification to PageInfo
// ============================================================================

export function buildPageInfos(
  pages: ProcessedPage[],
  classifications: PageClassification[],
  statuses?: Map<number, PageStatus>
): PageInfo[] {
  return pages.map((page) => {
    const classification = classifications.find((c) => c.pageNumber === page.pageNumber);
    return {
      pageNumber: page.pageNumber,
      sheetNumber: page.sheetNumber,
      pageType: classification?.pageType || page.estimatedType,
      trade: classification?.trade,
      confidence: classification?.confidence || 0.5,
      status: statuses?.get(page.pageNumber),
    };
  });
}
