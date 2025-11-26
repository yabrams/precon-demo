/**
 * RandomPDFPagesViewer Component
 * Displays 1-4 random pages from a PDF side by side with animated transitions
 * Each page has a hand-drawn circle around a random area
 * Hover on a page zooms into the circled area
 * Persists selected pages and circle areas in localStorage per item
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

// Circle area for each page (normalized 0-1 coordinates)
interface CircleArea {
  centerX: number; // 0-1 relative to page width
  centerY: number; // 0-1 relative to page height
  radiusX: number; // 0-1 relative to page width (~1/10 for 1/5 diameter)
  radiusY: number; // 0-1 relative to page height (~1/8 for 1/4 diameter)
  // Hand-drawn variation points for imperfect circle
  variation: number[];
}

// Stored data structure
interface StoredPageData {
  pages: number[];
  circles: CircleArea[];
}

// Local storage key generator
const getStorageKey = (bidPackageId: string, itemId: string) =>
  `pdf-pages-${bidPackageId}-${itemId}`;

// Generate hand-drawn circle variation points
const generateCircleVariation = (): number[] => {
  // Generate 16 points around the circle with random variations
  const points: number[] = [];

  // Create a base "wobble" that gives the circle character
  const baseWobble = (Math.random() - 0.5) * 0.15;

  for (let i = 0; i < 16; i++) {
    // Larger random variation between -0.2 and 0.2 of radius
    const randomVar = (Math.random() - 0.5) * 0.4;
    // Add some "clustering" - adjacent points tend to be similar
    const clusterInfluence = i > 0 ? points[i - 1] * 0.3 : 0;
    // Combine for more organic shape
    points.push(baseWobble + randomVar * 0.7 + clusterInfluence);
  }

  // Smooth transition back to start
  points[points.length - 1] = (points[points.length - 1] + points[0]) / 2;

  return points;
};

// Generate a random circle area for a page
const generateRandomCircle = (): CircleArea => {
  // Circle diameter should be ~1/5 of width and ~1/4 of height, then 20% smaller
  const radiusX = 0.08; // 1/10 of width * 0.8 = 0.08
  const radiusY = 0.1; // 1/8 of height * 0.8 = 0.1

  // Account for all variations when calculating bounds:
  // - Stored variation: up to 20%
  // - Angle jitter and control point variations: up to 10%
  // - Stroke width: ~3px (add 2% buffer)
  // Total buffer: ~35%
  const variationBuffer = 0.35;
  const effectiveRadiusX = radiusX * (1 + variationBuffer);
  const effectiveRadiusY = radiusY * (1 + variationBuffer);

  // Center position - ensure circle stays well within page bounds
  const minX = effectiveRadiusX;
  const maxX = 1 - effectiveRadiusX;
  const minY = effectiveRadiusY;
  const maxY = 1 - effectiveRadiusY;

  const centerX = minX + Math.random() * (maxX - minX);
  const centerY = minY + Math.random() * (maxY - minY);

  return {
    centerX,
    centerY,
    radiusX,
    radiusY,
    variation: generateCircleVariation(),
  };
};

// Get or generate random pages and circles for an item
const getOrGeneratePageData = (
  bidPackageId: string,
  itemId: string,
  totalPages: number
): StoredPageData => {
  if (typeof window === 'undefined' || totalPages < 1) {
    return { pages: [], circles: [] };
  }

  const storageKey = getStorageKey(bidPackageId, itemId);

  // Try to get from localStorage
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as StoredPageData;
      // Validate stored data
      if (
        parsed.pages &&
        Array.isArray(parsed.pages) &&
        parsed.pages.every(p => p >= 1 && p <= totalPages) &&
        parsed.circles &&
        Array.isArray(parsed.circles) &&
        parsed.circles.length === parsed.pages.length
      ) {
        return parsed;
      }
    } catch {
      // Invalid stored data, regenerate
    }
  }

  // Generate new random pages (1-4 pages)
  const numPages = Math.min(Math.floor(Math.random() * 4) + 1, totalPages);
  const availablePages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Shuffle and pick
  const shuffled = availablePages.sort(() => Math.random() - 0.5);
  const selectedPages = shuffled.slice(0, numPages).sort((a, b) => a - b);

  // Generate circle for each page
  const circles = selectedPages.map(() => generateRandomCircle());

  const pageData: StoredPageData = { pages: selectedPages, circles };

  // Store in localStorage
  localStorage.setItem(storageKey, JSON.stringify(pageData));

  return pageData;
};

// Hand-drawn circle SVG component
function HandDrawnCircle({
  centerX,
  centerY,
  radiusX,
  radiusY,
  variation,
  width,
  height,
}: CircleArea & { width: number; height: number }) {
  // Convert normalized coordinates to pixels
  const cx = centerX * width;
  const cy = centerY * height;
  const rx = radiusX * width;
  const ry = radiusY * height;

  // Generate hand-drawn path with variations
  const generatePath = () => {
    const points: string[] = [];
    const numPoints = variation.length;

    // Add slight rotation offset for more natural look
    const rotationOffset = variation[0] * 0.3;

    for (let i = 0; i <= numPoints; i++) {
      const idx = i % numPoints;
      const angle = (i / numPoints) * Math.PI * 2 + rotationOffset;
      const varFactor = 1 + variation[idx];

      // Add slight angle perturbation for more organic shape
      const angleJitter = variation[idx] * 0.15;
      const jitteredAngle = angle + angleJitter;

      const x = cx + Math.cos(jitteredAngle) * rx * varFactor;
      const y = cy + Math.sin(jitteredAngle) * ry * varFactor;

      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        // Use cubic bezier for smoother, more natural curves
        const prevIdx = (idx - 1 + numPoints) % numPoints;
        const prevAngle = ((i - 1) / numPoints) * Math.PI * 2 + rotationOffset + variation[prevIdx] * 0.15;
        const prevVarFactor = 1 + variation[prevIdx];

        // Two control points for cubic bezier - creates more flowing lines
        const ctrl1Angle = prevAngle + (angle - prevAngle) * 0.33;
        const ctrl2Angle = prevAngle + (angle - prevAngle) * 0.67;

        const ctrl1VarFactor = prevVarFactor + (varFactor - prevVarFactor) * 0.33 + variation[idx] * 0.1;
        const ctrl2VarFactor = prevVarFactor + (varFactor - prevVarFactor) * 0.67 - variation[prevIdx] * 0.1;

        const ctrl1X = cx + Math.cos(ctrl1Angle) * rx * ctrl1VarFactor;
        const ctrl1Y = cy + Math.sin(ctrl1Angle) * ry * ctrl1VarFactor;
        const ctrl2X = cx + Math.cos(ctrl2Angle) * rx * ctrl2VarFactor;
        const ctrl2Y = cy + Math.sin(ctrl2Angle) * ry * ctrl2VarFactor;

        points.push(`C ${ctrl1X} ${ctrl1Y} ${ctrl2X} ${ctrl2Y} ${x} ${y}`);
      }
    }

    return points.join(' ');
  };

  // Memoize the path to avoid regenerating on each render
  const path = generatePath();

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-hidden"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Clip to bounds */}
      <defs>
        <clipPath id={`clip-${centerX}-${centerY}`}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${centerX}-${centerY})`}>
        {/* Main circle stroke */}
        <path
          d={path}
          fill="none"
          stroke="#ef4444"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        {/* Slight offset duplicate for hand-drawn effect */}
        <path
          d={path}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.4}
          transform="translate(1, 1)"
        />
      </g>
    </svg>
  );
}

// Base resolution multiplier for PDF.js - renders at higher quality
const PDF_RESOLUTION_SCALE = 2;

// Calculate zoom scale to focus on circle area
function calculateZoomScale(circle: CircleArea): number {
  // Zoom to show circle + 50% beyond
  const circleWidthRatio = circle.radiusX * 2;
  const circleHeightRatio = circle.radiusY * 2;

  // Add 50% padding around circle (circle takes ~67% of view)
  const viewWidthRatio = circleWidthRatio * 1.5;
  const viewHeightRatio = circleHeightRatio * 1.5;

  // Scale to fit the larger dimension
  const scaleX = 1 / viewWidthRatio;
  const scaleY = 1 / viewHeightRatio;
  return Math.min(scaleX, scaleY, 4); // Cap at 4x zoom
}

export default function RandomPDFPagesViewer({
  pdfUrl,
  itemId,
  bidPackageId,
  className = '',
}: RandomPDFPagesViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageData, setPageData] = useState<StoredPageData>({ pages: [], circles: [] });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [actualPageHeight, setActualPageHeight] = useState<number>(0);
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

  // Handle page load to get actual rendered dimensions
  // Divide by PDF_RESOLUTION_SCALE since we render at higher resolution
  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    const normalizedHeight = page.height / PDF_RESOLUTION_SCALE;
    if (normalizedHeight && normalizedHeight !== actualPageHeight) {
      setActualPageHeight(normalizedHeight);
    }
  }, [actualPageHeight]);

  // Update selected pages when numPages or itemId changes
  useEffect(() => {
    if (numPages > 0 && itemId && bidPackageId) {
      const data = getOrGeneratePageData(bidPackageId, itemId, numPages);
      setPageData(data);
      // Reset actual page height when item changes - will be recalculated on page load
      if (itemId !== prevItemIdRef.current) {
        setActualPageHeight(0);
      }
      prevItemIdRef.current = itemId;
    }
  }, [numPages, itemId, bidPackageId]);

  // Calculate page dimensions: fit within 100% width, then maximize height up to 100%
  const pageDimensions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0 || pageData.pages.length === 0) {
      return { width: 200, height: 280 };
    }

    const numPagesDisplay = pageData.pages.length;
    const gap = 16; // 16px gap between pages
    const padding = 32; // 16px padding on each side
    const pageNumberHeight = 28; // Height of page number indicator

    // Available dimensions
    const availableWidth = containerSize.width - padding - (gap * (numPagesDisplay - 1));
    const availableHeight = containerSize.height - padding - pageNumberHeight;

    // PDF aspect ratio (US Letter: 8.5x11 ≈ 0.77 width/height ratio)
    const aspectRatio = 0.77;

    // Start by maximizing height (100% of available height)
    const maxHeight = availableHeight;
    const widthFromMaxHeight = maxHeight * aspectRatio;
    const totalWidthAtMaxHeight = widthFromMaxHeight * numPagesDisplay;

    // Check if all pages at max height fit within available width
    if (totalWidthAtMaxHeight <= availableWidth) {
      // Height-constrained: use 100% height, width fits within container
      return { width: widthFromMaxHeight, height: maxHeight };
    } else {
      // Width-constrained: scale down to fit within 100% width
      const widthPerPage = availableWidth / numPagesDisplay;
      const heightFromWidth = widthPerPage / aspectRatio;
      return { width: widthPerPage, height: heightFromWidth };
    }
  }, [containerSize, pageData.pages.length]);

  // Detect item change for animation direction
  const isNewItem = itemId !== prevItemIdRef.current;

  // Calculate sizes for hover effect
  const getPageScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    if (index === hoveredIndex) return 1.15; // Hovered page expands 15%
    return 0.85; // Other pages shrink to 85%
  };

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
      {!isLoading && !pdfError && pageData.pages.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${itemId}-${pageData.pages.join('-')}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
            className="flex items-center justify-center gap-4"
          >
            {pageData.pages.map((pageNum, index) => {
              const circle = pageData.circles[index];
              const isHovered = hoveredIndex === index;
              // Use actual page height if available, otherwise fall back to calculated
              const displayHeight = actualPageHeight || pageDimensions.height;
              const zoomScale = circle ? calculateZoomScale(circle) : 1;
              const pageScale = getPageScale(index);

              // Container dimensions
              const containerWidth = pageDimensions.width;
              const containerHeight = displayHeight;

              // Transform origin at circle center (as percentage)
              const originX = circle ? circle.centerX * 100 : 50;
              const originY = circle ? circle.centerY * 100 : 50;

              return (
                <motion.div
                  key={`${itemId}-page-${pageNum}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: pageScale,
                    zIndex: isHovered ? 10 : 1,
                  }}
                  transition={{
                    duration: 0.3,
                    delay: isNewItem ? index * 0.1 : 0,
                    ease: 'easeOut',
                  }}
                  className="bg-white shadow-lg rounded-sm overflow-hidden cursor-pointer"
                  style={{
                    transformOrigin: 'center center',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: containerWidth,
                      height: containerHeight,
                    }}
                  >
                    <motion.div
                      animate={{
                        scale: isHovered ? zoomScale : 1,
                      }}
                      transition={{
                        duration: 0.4,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      style={{
                        transformOrigin: `${originX}% ${originY}%`,
                        width: containerWidth,
                        height: containerHeight,
                      }}
                    >
                      {/* PDF rendered at higher resolution, scaled down to fit */}
                      <div
                        style={{
                          width: containerWidth,
                          height: containerHeight,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            transform: `scale(${1 / PDF_RESOLUTION_SCALE})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          <Document file={pdfUrl} loading={null} error={null}>
                            <Page
                              pageNumber={pageNum}
                              width={pageDimensions.width * PDF_RESOLUTION_SCALE}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={onPageLoadSuccess}
                            />
                          </Document>
                        </div>
                      </div>
                      {/* Hand-drawn circle overlay */}
                      {circle && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: containerWidth,
                            height: containerHeight,
                            pointerEvents: 'none',
                          }}
                        >
                          <HandDrawnCircle
                            {...circle}
                            width={containerWidth}
                            height={containerHeight}
                          />
                        </div>
                      )}
                    </motion.div>
                  </div>
                  {/* Page number indicator */}
                  <div className="bg-zinc-900 text-white text-xs py-1 px-2 text-center font-mono">
                    Page {pageNum}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state when no pages */}
      {!isLoading && !pdfError && pageData.pages.length === 0 && numPages === 0 && (
        <div className="text-gray-500 text-sm">No PDF pages available</div>
      )}
    </div>
  );
}
