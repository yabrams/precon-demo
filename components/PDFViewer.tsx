/**
 * PDFViewer Component
 * Displays single or multiple PDF files with zoom, navigation, and document switching
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Grid, Grid3x3 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PDFDocument {
  url: string;
  fileName: string;
}

interface PDFViewerProps {
  documents: PDFDocument | PDFDocument[];
  className?: string;
  onDocumentLoadSuccess?: (documentIndex: number, numPages: number) => void;
  onDocumentLoadError?: (error: Error) => void;
}

export default function PDFViewer({
  documents,
  className = '',
  onDocumentLoadSuccess,
  onDocumentLoadError,
}: PDFViewerProps) {
  const docs = Array.isArray(documents) ? documents : [documents];
  const hasMultipleDocs = docs.length > 1;

  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [baseScale, setBaseScale] = useState(1.0); // Scale that makes PDF fit container height
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const [pdfPageHeight, setPdfPageHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentDoc = docs[currentDocIndex];

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateContainerHeight = () => {
      if (containerRef.current) {
        // Subtract padding (32px = 16px * 2 for p-4)
        const height = containerRef.current.clientHeight - 32;
        setContainerHeight(height);
      }
    };

    updateContainerHeight();

    const resizeObserver = new ResizeObserver(updateContainerHeight);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate base scale when container or PDF dimensions change
  useEffect(() => {
    if (containerHeight > 0 && pdfPageHeight > 0) {
      const fitScale = containerHeight / pdfPageHeight;
      setBaseScale(fitScale);
      // Set initial scale to fit height (100%)
      setScale(fitScale);
    }
  }, [containerHeight, pdfPageHeight]);

  const onDocumentLoad = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setPageNumber(1);
      onDocumentLoadSuccess?.(currentDocIndex, numPages);
    },
    [currentDocIndex, onDocumentLoadSuccess]
  );

  const onDocumentError = useCallback(
    (error: Error) => {
      console.error('PDF load error:', error);
      onDocumentLoadError?.(error);
    },
    [onDocumentLoadError]
  );

  const changePage = (offset: number) => {
    setPageNumber((prevPage) => {
      const newPage = prevPage + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  };

  const changeDocument = (newIndex: number) => {
    setCurrentDocIndex(newIndex);
    setPageNumber(1);
    setPdfPageHeight(0); // Reset to trigger recalculation
  };

  // Handle page load to get PDF dimensions
  const onPageLoad = useCallback(
    (page: { height: number; width: number; originalHeight: number; originalWidth: number }) => {
      // Use original height (unscaled) for calculations
      if (page.originalHeight && page.originalHeight !== pdfPageHeight) {
        setPdfPageHeight(page.originalHeight);
      }
    },
    [pdfPageHeight]
  );

  // Zoom steps relative to base scale (fit-to-height = 100%)
  const zoomStep = baseScale * 0.2;
  const handleZoomIn = () => setScale((prev) => Math.min(prev + zoomStep, baseScale * 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - zoomStep, baseScale * 0.5));
  const handleFullscreen = () => setIsFullscreen((prev) => !prev);

  // Calculate display percentage (100% = fit to height)
  const displayPercentage = baseScale > 0 ? Math.round((scale / baseScale) * 100) : 100;

  return (
    <div
      className={`flex flex-col h-full bg-gray-50 ${className} ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-2">
          {/* Document Selector */}
          {hasMultipleDocs && (
            <div className="flex items-center space-x-2 pr-4 border-r border-gray-200">
              <span className="text-sm text-gray-600 font-medium">Document:</span>
              <select
                value={currentDocIndex}
                onChange={(e) => changeDocument(parseInt(e.target.value))}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400"
              >
                {docs.map((doc, index) => (
                  <option key={index} value={index}>
                    {doc.fileName}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                ({currentDocIndex + 1} of {docs.length})
              </span>
            </div>
          )}

          {/* Page Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              Page {pageNumber} of {numPages || '...'}
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1">
          {/* Thumbnails Toggle */}
          {(hasMultipleDocs || numPages > 1) && (
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-1.5 rounded hover:bg-gray-100 mr-2 ${
                showThumbnails ? 'bg-zinc-100 text-zinc-900' : ''
              }`}
              title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          )}

          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-gray-100"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[50px] text-center">
            {displayPercentage}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-gray-100"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded hover:bg-gray-100"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Thumbnail Carousel (for multiple documents or pages) */}
      {showThumbnails && (hasMultipleDocs || numPages > 1) && (
        <div className="bg-white border-b border-gray-200 px-4 flex-shrink-0">
          <div className="flex items-center space-x-3 overflow-x-auto">
            {hasMultipleDocs ? (
              // Multiple documents: show document thumbnails
              docs.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => changeDocument(index)}
                  className={`flex-shrink-0 transition-opacity ${
                    index === currentDocIndex ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                  }`}
                  title={doc.fileName}
                >
                  <div className="w-32 h-40 bg-gray-100 flex items-center justify-center">
                    <Document
                      file={doc.url}
                      loading={
                        <div className="flex items-center justify-center w-full h-full">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900"></div>
                        </div>
                      }
                      error={
                        <div className="flex items-center justify-center w-full h-full text-xs text-gray-400">
                          Error
                        </div>
                      }
                    >
                      <Page
                        pageNumber={1}
                        width={128}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  </div>
                </button>
              ))
            ) : (
              // Single document with multiple pages: show page thumbnails
              Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setPageNumber(page)}
                  className={`flex-shrink-0 transition-opacity ${
                    page === pageNumber ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                  }`}
                  title={`Page ${page}`}
                >
                  <div className="w-32 h-40 bg-gray-100 flex items-center justify-center">
                    <Document file={currentDoc.url}>
                      <Page
                        pageNumber={page}
                        width={128}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* PDF Document Container */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
        <div className="bg-white shadow-lg">
          <Document
            file={currentDoc.url}
            onLoadSuccess={onDocumentLoad}
            onLoadError={onDocumentError}
            loading={
              <div className="flex items-center justify-center min-h-[600px] min-w-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center min-h-[600px] min-w-[400px]">
                <div className="text-center p-8">
                  <p className="text-red-600 font-medium mb-2">Failed to load PDF</p>
                  <p className="text-gray-600 text-sm">
                    The PDF file could not be loaded. Please try again.
                  </p>
                </div>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-md"
              onLoadSuccess={onPageLoad}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
