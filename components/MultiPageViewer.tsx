/**
 * MultiPageViewer Component
 *
 * Specialized viewer for large multi-page construction documents.
 * Features trade-based grouping, extraction progress tracking, and
 * page navigation with classification indicators.
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Layers,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { PageType, ProcessedPage } from '@/lib/pdf-utils';
import { PageClassification, ClassifiedDocument } from '@/lib/extraction/page-classifier';

// ============================================================================
// TYPES
// ============================================================================

export interface PageExtractionStatus {
  pageNumber: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  itemsFound?: number;
  error?: string;
}

export interface TradeGroup {
  trade: string;
  csiDivision: string;
  csiDivisionName: string;
  pages: PageClassification[];
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  itemsFound: number;
  progress: number; // 0-100
}

export interface MultiPageViewerProps {
  /** Array of processed PDF pages */
  pages: ProcessedPage[];
  /** Classification data for the document */
  classification: ClassifiedDocument;
  /** Extraction status per page */
  pageStatuses?: Map<number, PageExtractionStatus>;
  /** Currently processing trade */
  currentTrade?: string;
  /** Overall extraction progress 0-100 */
  extractionProgress?: number;
  /** Callback when a page is selected */
  onPageSelect?: (pageNumber: number) => void;
  /** Callback when a trade is selected for viewing */
  onTradeSelect?: (trade: string) => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const PAGE_TYPE_ICONS: Record<PageType, string> = {
  cover: '📋',
  index: '📑',
  plan: '📐',
  schedule: '📊',
  detail: '🔍',
  section: '📏',
  elevation: '🏛️',
  specification: '📄',
  diagram: '📈',
  legend: '🗝️',
  general_notes: '📝',
};

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  cover: 'Cover',
  index: 'Index',
  plan: 'Plan',
  schedule: 'Schedule',
  detail: 'Detail',
  section: 'Section',
  elevation: 'Elevation',
  specification: 'Spec',
  diagram: 'Diagram',
  legend: 'Legend',
  general_notes: 'Notes',
};

function getStatusIcon(status: 'pending' | 'processing' | 'completed' | 'failed') {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MultiPageViewer({
  pages,
  classification,
  pageStatuses,
  currentTrade,
  extractionProgress = 0,
  onPageSelect,
  onTradeSelect,
  className = '',
}: MultiPageViewerProps) {
  // State
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [viewMode, setViewMode] = useState<'single' | 'thumbnails' | 'trades'>('single');
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute trade groups from classification
  const tradeGroups = useMemo((): TradeGroup[] => {
    const groups: TradeGroup[] = [];

    for (const [trade, tradePages] of classification.tradeGroups) {
      // Get extraction status for this trade's pages
      let completedPages = 0;
      let itemsFound = 0;
      let hasProcessing = false;
      let hasFailed = false;

      for (const pageClass of tradePages) {
        const status = pageStatuses?.get(pageClass.pageNumber);
        if (status?.status === 'completed') {
          completedPages++;
          itemsFound += status.itemsFound || 0;
        } else if (status?.status === 'processing') {
          hasProcessing = true;
        } else if (status?.status === 'failed') {
          hasFailed = true;
        }
      }

      let extractionStatus: TradeGroup['extractionStatus'] = 'pending';
      if (hasFailed) {
        extractionStatus = 'failed';
      } else if (hasProcessing) {
        extractionStatus = 'processing';
      } else if (completedPages === tradePages.length && completedPages > 0) {
        extractionStatus = 'completed';
      }

      groups.push({
        trade,
        csiDivision: tradePages[0]?.csiDivision || '00',
        csiDivisionName: tradePages[0]?.csiDivisionName || 'Unknown',
        pages: tradePages,
        extractionStatus,
        itemsFound,
        progress: tradePages.length > 0 ? (completedPages / tradePages.length) * 100 : 0,
      });
    }

    // Sort by CSI division
    return groups.sort((a, b) => a.csiDivision.localeCompare(b.csiDivision));
  }, [classification, pageStatuses]);

  // Get current page
  const currentPage = pages[currentPageIndex];
  const currentClassification = classification.classifications[currentPageIndex];

  // Filter pages by selected trade
  const visiblePages = useMemo(() => {
    if (!selectedTrade) return pages;
    const tradePageNumbers = new Set(
      classification.tradeGroups.get(selectedTrade)?.map((p) => p.pageNumber) || []
    );
    return pages.filter((p) => tradePageNumbers.has(p.pageNumber));
  }, [pages, selectedTrade, classification]);

  // Navigation
  const goToPage = useCallback(
    (pageIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
      setCurrentPageIndex(clampedIndex);
      onPageSelect?.(pages[clampedIndex].pageNumber);
    },
    [pages, onPageSelect]
  );

  const handlePrevPage = useCallback(() => {
    goToPage(currentPageIndex - 1);
  }, [currentPageIndex, goToPage]);

  const handleNextPage = useCallback(() => {
    goToPage(currentPageIndex + 1);
  }, [currentPageIndex, goToPage]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Trade selection
  const handleTradeClick = useCallback(
    (trade: string) => {
      setSelectedTrade(trade === selectedTrade ? null : trade);
      onTradeSelect?.(trade);

      // Jump to first page of the trade
      const tradePages = classification.tradeGroups.get(trade);
      if (tradePages && tradePages.length > 0) {
        const firstPageNum = tradePages[0].pageNumber;
        const pageIndex = pages.findIndex((p) => p.pageNumber === firstPageNum);
        if (pageIndex >= 0) {
          goToPage(pageIndex);
        }
      }
    },
    [selectedTrade, classification, pages, goToPage, onTradeSelect]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut]);

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Page navigation */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevPage}
              disabled={currentPageIndex === 0}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous page (←)"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <span className="text-sm font-medium min-w-[100px] text-center">
              Page {currentPage?.pageNumber || 1} of {pages.length}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPageIndex === pages.length - 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next page (→)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Sheet number & type */}
            {currentClassification && (
              <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                {currentPage?.sheetNumber && (
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                    {currentPage.sheetNumber}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {PAGE_TYPE_ICONS[currentClassification.pageType]}{' '}
                  {PAGE_TYPE_LABELS[currentClassification.pageType]}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {currentClassification.trade}
                </span>
              </div>
            )}
          </div>

          {/* Center: Extraction progress (if active) */}
          {extractionProgress > 0 && extractionProgress < 100 && (
            <div className="flex items-center space-x-3">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{Math.round(extractionProgress)}%</span>
            </div>
          )}

          {/* Right: View modes and zoom */}
          <div className="flex items-center space-x-2">
            {/* View mode toggles */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('single')}
                className={`p-1.5 ${viewMode === 'single' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                title="Single page view"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('thumbnails')}
                className={`p-1.5 ${viewMode === 'thumbnails' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                title="Thumbnail view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('trades')}
                className={`p-1.5 ${viewMode === 'trades' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                title="View by trades"
              >
                <Layers className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center space-x-1 pl-2 border-l border-gray-200">
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Zoom out (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium min-w-[40px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Zoom in (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Trade filter bar (shown when trades view is active) */}
        {viewMode === 'trades' && (
          <div className="mt-2 flex items-center space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedTrade(null)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                !selectedTrade
                  ? 'bg-zinc-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({pages.length})
            </button>
            {tradeGroups.map((group) => (
              <button
                key={group.trade}
                onClick={() => handleTradeClick(group.trade)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap flex items-center space-x-1 ${
                  selectedTrade === group.trade
                    ? 'bg-zinc-900 text-white'
                    : group.trade === currentTrade
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getStatusIcon(group.extractionStatus)}
                <span>
                  {group.trade} ({group.pages.length})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex">
        {/* Thumbnail sidebar (when in trades or thumbnails mode) */}
        {(viewMode === 'thumbnails' || viewMode === 'trades') && (
          <div className="w-48 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-2 space-y-2">
              {visiblePages.map((page, idx) => {
                const pageClass = classification.classifications.find(
                  (c) => c.pageNumber === page.pageNumber
                );
                const status = pageStatuses?.get(page.pageNumber);
                const isActive = pages[currentPageIndex]?.pageNumber === page.pageNumber;

                return (
                  <button
                    key={page.pageNumber}
                    onClick={() => {
                      const globalIdx = pages.findIndex((p) => p.pageNumber === page.pageNumber);
                      goToPage(globalIdx);
                    }}
                    className={`w-full text-left rounded-lg overflow-hidden transition-all ${
                      isActive
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'hover:ring-1 hover:ring-gray-300'
                    }`}
                  >
                    {/* Thumbnail image */}
                    <div className="relative aspect-[3/4] bg-gray-100">
                      {page.thumbnailBuffer ? (
                        <img
                          src={`data:image/jpeg;base64,${Buffer.from(page.thumbnailBuffer).toString('base64')}`}
                          alt={`Page ${page.pageNumber}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          Page {page.pageNumber}
                        </div>
                      )}

                      {/* Status indicator */}
                      {status && (
                        <div className="absolute top-1 right-1">
                          {getStatusIcon(status.status)}
                        </div>
                      )}
                    </div>

                    {/* Page info */}
                    <div className="p-1.5 bg-gray-50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {page.sheetNumber || `P${page.pageNumber}`}
                        </span>
                        {status?.itemsFound !== undefined && status.itemsFound > 0 && (
                          <span className="text-green-600 font-medium">
                            {status.itemsFound} items
                          </span>
                        )}
                      </div>
                      {pageClass && (
                        <span className="text-gray-500 truncate block">
                          {pageClass.trade}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main page view */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-100">
          <AnimatePresence mode="wait">
            {currentPage && (
              <motion.div
                key={currentPage.pageNumber}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="bg-white shadow-lg"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                }}
              >
                <img
                  src={`data:${currentPage.contentType};base64,${Buffer.from(currentPage.imageBuffer).toString('base64')}`}
                  alt={`Page ${currentPage.pageNumber}`}
                  className="max-w-none"
                  style={{
                    width: currentPage.width,
                    height: currentPage.height,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trade summary panel (when in trades mode) */}
        {viewMode === 'trades' && (
          <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Trade Summary</h3>
              <div className="space-y-3">
                {tradeGroups.map((group) => (
                  <div
                    key={group.trade}
                    className={`p-3 rounded-lg border ${
                      group.trade === currentTrade
                        ? 'border-blue-300 bg-blue-50'
                        : group.trade === selectedTrade
                        ? 'border-zinc-300 bg-zinc-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{group.trade}</span>
                      {getStatusIcon(group.extractionStatus)}
                    </div>

                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>CSI Division:</span>
                        <span className="font-mono">
                          {group.csiDivision} - {group.csiDivisionName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pages:</span>
                        <span>{group.pages.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Items Found:</span>
                        <span className="text-green-600 font-medium">{group.itemsFound}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {group.extractionStatus === 'processing' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${group.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Overall stats */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Document Stats
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pages:</span>
                    <span className="font-medium">{pages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trades Identified:</span>
                    <span className="font-medium">{tradeGroups.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CSI Divisions:</span>
                    <span className="font-medium">
                      {classification.summary.csiDivisionsIdentified.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
