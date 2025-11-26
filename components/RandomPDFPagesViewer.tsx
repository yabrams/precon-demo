/**
 * RandomPDFPagesViewer Component
 * Displays 2-4 random pages from a PDF side by side with animated transitions
 * Persists selected pages in localStorage per item for consistent navigation
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface RandomPDFPagesViewerProps {
  pdfUrl: string;
  itemId: string;
  bidPackageId: string;
  className?: string;
}

// Local storage key generator
const getStorageKey = (bidPackageId: string, itemId: string) =>
  `pdf-pages-${bidPackageId}-${itemId}`;

// Get or generate random pages for an item
const getOrGeneratePages = (
  bidPackageId: string,
  itemId: string,
  totalPages: number
): number[] => {
  if (typeof window === 'undefined' || totalPages < 1) return [];

  const storageKey = getStorageKey(bidPackageId, itemId);

  // Try to get from localStorage
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Validate stored pages are still valid for this PDF
      if (Array.isArray(parsed) && parsed.every(p => p >= 1 && p <= totalPages)) {
        return parsed;
      }
    } catch {
      // Invalid stored data, regenerate
    }
  }

  // Generate new random pages (1-4 pages)
  const numPages = Math.min(Math.floor(Math.random() * 4) + 1, totalPages); // 1-4 pages
  const availablePages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Shuffle and pick
  const shuffled = availablePages.sort(() => Math.random() - 0.5);
  const selectedPages = shuffled.slice(0, numPages).sort((a, b) => a - b);

  // Store in localStorage
  localStorage.setItem(storageKey, JSON.stringify(selectedPages));

  return selectedPages;
};

export default function RandomPDFPagesViewer({
  pdfUrl,
  itemId,
  bidPackageId,
  className = '',
}: RandomPDFPagesViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevItemIdRef = useRef<string>(itemId);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle PDF load
  const onDocumentLoad = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      setPdfError(false);
      setIsLoading(false);
    },
    []
  );

  const onDocumentError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setPdfError(true);
    setIsLoading(false);
  }, []);

  // Update selected pages when numPages or itemId changes
  useEffect(() => {
    if (numPages > 0 && itemId && bidPackageId) {
      const pages = getOrGeneratePages(bidPackageId, itemId, numPages);
      setSelectedPages(pages);
      prevItemIdRef.current = itemId;
    }
  }, [numPages, itemId, bidPackageId]);

  // Calculate page dimensions so all pages fill 100% width while fitting height
  const pageDimensions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0 || selectedPages.length === 0) {
      return { width: 200, height: 280 };
    }

    const numPagesDisplay = selectedPages.length;
    const gap = 16; // 16px gap between pages
    const padding = 32; // 16px padding on each side
    const pageNumberHeight = 28; // Height of page number indicator

    // Available dimensions
    const availableWidth = containerSize.width - padding - (gap * (numPagesDisplay - 1));
    const availableHeight = containerSize.height - padding - pageNumberHeight;

    // Width per page to fill 100% of available width
    const widthPerPage = availableWidth / numPagesDisplay;

    // Calculate height based on typical PDF aspect ratio (US Letter: 8.5x11 ≈ 0.77 ratio)
    const aspectRatio = 0.77;
    const heightFromWidth = widthPerPage / aspectRatio;

    // If calculated height exceeds available height, constrain by height instead
    if (heightFromWidth <= availableHeight) {
      // Width-constrained: pages fill 100% width
      return { width: widthPerPage, height: heightFromWidth };
    } else {
      // Height-constrained: pages fill 100% height, may not fill full width
      const widthFromHeight = availableHeight * aspectRatio;
      return { width: widthFromHeight, height: availableHeight };
    }
  }, [containerSize, selectedPages.length]);

  // Detect item change for animation direction
  const isNewItem = itemId !== prevItemIdRef.current;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center bg-gray-100 overflow-hidden ${className}`}
    >
      {/* Hidden document for loading pages */}
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoad}
        onLoadError={onDocumentError}
        loading={null}
        error={null}
      >
        {/* Don't render anything here - we just need the document loaded */}
      </Document>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading PDF...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {pdfError && !isLoading && (
        <div className="text-center p-8">
          <p className="text-red-600 font-medium mb-2">Failed to load PDF</p>
          <p className="text-gray-600 text-sm">
            The PDF file could not be loaded. Please try again.
          </p>
        </div>
      )}

      {/* Pages Display with Animation */}
      {!isLoading && !pdfError && selectedPages.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${itemId}-${selectedPages.join('-')}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
            className="flex items-center justify-center gap-4"
          >
            {selectedPages.map((pageNum, index) => (
              <motion.div
                key={`${itemId}-page-${pageNum}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                  ease: 'easeOut',
                }}
                className="bg-white shadow-lg rounded-sm overflow-hidden"
              >
                <Document file={pdfUrl} loading={null} error={null}>
                  <Page
                    pageNumber={pageNum}
                    width={pageDimensions.width}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
                {/* Page number indicator */}
                <div className="bg-zinc-900 text-white text-xs py-1 px-2 text-center font-mono">
                  Page {pageNum}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state when no pages */}
      {!isLoading && !pdfError && selectedPages.length === 0 && numPages === 0 && (
        <div className="text-gray-500 text-sm">No PDF pages available</div>
      )}
    </div>
  );
}
