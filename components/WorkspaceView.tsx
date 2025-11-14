'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import BidFormTable, { LineItem } from './BidFormTable';
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export';
import DiagramOverlay from './DiagramOverlay';
import ChatPanel from './ChatPanel';
import MagnifyingGlass from './MagnifyingGlass';
import { ChatMessage } from '@/types/chat';

interface WorkspaceViewProps {
  diagramUrl: string | null;
  lineItems: LineItem[];
  isExtracting: boolean;
  onLineItemsUpdate: (items: LineItem[]) => void;
  onUploadNew: () => void;
  onReExtract?: (instructions: string) => void;
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  onChatToggle: () => void;
  onSendChatMessage: (message: string) => void;
  onAcceptChatChanges: (messageId: string) => void;
  onRejectChatChanges: (messageId: string) => void;
  isChatLoading?: boolean;
}

export default function WorkspaceView({
  diagramUrl,
  lineItems,
  isExtracting,
  onLineItemsUpdate,
  onUploadNew,
  onReExtract,
  chatOpen,
  chatMessages,
  onChatToggle,
  onSendChatMessage,
  onAcceptChatChanges,
  onRejectChatChanges,
  isChatLoading = false,
}: WorkspaceViewProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredRowElement, setHoveredRowElement] = useState<HTMLTableRowElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showInstructionsPanel, setShowInstructionsPanel] = useState(false);
  const [reExtractionInstructions, setReExtractionInstructions] = useState('');
  const [magnifyingGlassEnabled, setMagnifyingGlassEnabled] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Update image dimensions and zoom level when image loads or on resize
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        setImageDimensions({ width, height });

        // Calculate zoom level
        const naturalWidth = imageRef.current.naturalWidth;
        const naturalHeight = imageRef.current.naturalHeight;

        if (naturalWidth > 0 && naturalHeight > 0) {
          // Calculate scale for both dimensions and use the smaller one (object-contain behavior)
          const scaleX = width / naturalWidth;
          const scaleY = height / naturalHeight;
          const scale = Math.min(scaleX, scaleY);
          setZoomLevel(Math.round(scale * 100));
        }
      }
    };

    // Update on image load
    const img = imageRef.current;
    if (img) {
      img.addEventListener('load', updateImageDimensions);
      // Also update immediately in case image is already loaded
      updateImageDimensions();
    }

    // Update on window resize
    window.addEventListener('resize', updateImageDimensions);

    // Watch for panel resize using ResizeObserver
    let resizeObserver: ResizeObserver | null = null;
    if (img?.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        updateImageDimensions();
      });
      resizeObserver.observe(img.parentElement);
    }

    return () => {
      if (img) {
        img.removeEventListener('load', updateImageDimensions);
      }
      window.removeEventListener('resize', updateImageDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [diagramUrl]);

  const handleHoverChange = (itemId: string | null, element?: HTMLTableRowElement | null) => {
    setHoveredItemId(itemId);
    setHoveredRowElement(element || null);
  };

  // Calculate connection line positions and color
  const getConnectionLineProps = () => {
    if (!hoveredItemId || !hoveredRowElement || !imageRef.current || !workspaceRef.current) {
      return null;
    }

    const item = lineItems.find((item) => item.id === hoveredItemId);
    const itemIndex = lineItems.findIndex((item) => item.id === hoveredItemId);
    if (!item || !item.boundingBox || itemIndex === -1) {
      return null;
    }

    // Get positions
    const workspaceRect = workspaceRef.current.getBoundingClientRect();
    const rowRect = hoveredRowElement.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();

    // Calculate from position (middle left of table row)
    const fromX = rowRect.left - workspaceRect.left;
    const fromY = rowRect.top + rowRect.height / 2 - workspaceRect.top;

    // Calculate to position (center of bounding box)
    const { x, y, width, height } = item.boundingBox;
    const boxCenterX = (x + width / 2) * imageDimensions.width;
    const boxCenterY = (y + height / 2) * imageDimensions.height;
    const toX = imageRect.left - workspaceRect.left + boxCenterX;
    const toY = imageRect.top - workspaceRect.top + boxCenterY;

    // Get color
    const HIGHLIGHT_COLORS = [
      '#93c5fd', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd',
      '#fdba74', '#f9a8d4', '#67e8f9', '#d8b4fe', '#a7f3d0',
    ];
    const color = HIGHLIGHT_COLORS[itemIndex % HIGHLIGHT_COLORS.length];

    return { fromX, fromY, toX, toY, color };
  };

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    if (format === 'pdf') {
      exportToPDF(lineItems, projectName);
    } else if (format === 'excel') {
      exportToExcel(lineItems, projectName);
    } else if (format === 'csv') {
      exportToCSV(lineItems);
    }
  };

  const connectionLineProps = getConnectionLineProps();

  return (
    <div ref={workspaceRef} className="h-screen overflow-hidden bg-gray-50 relative">
      {/* Connection Line Overlay */}
      <AnimatePresence>
        {connectionLineProps && (
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full"
            style={{ zIndex: 1000 }}
          >
            {/* Curved connection line */}
            <motion.path
              d={`M ${connectionLineProps.fromX} ${connectionLineProps.fromY} C ${connectionLineProps.fromX - 100} ${connectionLineProps.fromY}, ${connectionLineProps.toX + 100} ${connectionLineProps.toY}, ${connectionLineProps.toX} ${connectionLineProps.toY}`}
              stroke={connectionLineProps.color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="5,5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            />
            {/* Endpoint marker on diagram */}
            <motion.circle
              cx={connectionLineProps.toX}
              cy={connectionLineProps.toY}
              r={5}
              fill={connectionLineProps.color}
              stroke="white"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            />
          </svg>
        )}
      </AnimatePresence>

      {/* Chat Overlay */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed left-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50"
          >
            <ChatPanel
              messages={chatMessages}
              onSendMessage={onSendChatMessage}
              onAcceptChanges={onAcceptChatChanges}
              onRejectChanges={onRejectChatChanges}
              isLoading={isChatLoading}
              onClose={onChatToggle}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Toggle Overlay Button */}
      <button
        onClick={onChatToggle}
        className={`fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full shadow-lg transition-all flex items-center justify-center font-medium text-2xl ${
          chatOpen
            ? 'bg-gray-600 hover:bg-gray-700'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        title={chatOpen ? 'Close AI Chat' : 'Open AI Chat'}
      >
        💬
      </button>

      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Diagram Viewer */}
        <Panel defaultSize={35} minSize={20} className="relative bg-white flex flex-col">
          {/* Diagram Content */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {diagramUrl ? (
                <motion.div
                  key="diagram"
                  initial={{ scale: 1, x: 0 }}
                  animate={{ scale: 1, x: 0 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  <div className="relative inline-block">
                    <img
                      ref={imageRef}
                      src={diagramUrl}
                      alt="Construction Diagram"
                      className="max-w-full max-h-full object-contain shadow-lg rounded"
                    />
                    <DiagramOverlay
                      lineItems={lineItems}
                      hoveredItemId={hoveredItemId}
                      onHoverChange={(id) => handleHoverChange(id, null)}
                      imageWidth={imageDimensions.width}
                      imageHeight={imageDimensions.height}
                    />
                    {/* Magnifying Glass */}
                    {diagramUrl && (
                      <MagnifyingGlass
                        imageSrc={diagramUrl}
                        imageRef={imageRef}
                        enabled={magnifyingGlassEnabled}
                        zoomFactor={2.5}
                        lensWidth={300}
                        lensHeight={180}
                      />
                    )}
                    {/* Bottom right controls */}
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      {/* Zoom level indicator */}
                      <div className="bg-black bg-opacity-70 text-white px-3 py-1.5 rounded text-sm font-medium pointer-events-none">
                        {zoomLevel}%
                      </div>
                      {/* Magnifying Glass Toggle Button */}
                      <button
                        onClick={() => setMagnifyingGlassEnabled(!magnifyingGlassEnabled)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-2 ${
                          magnifyingGlassEnabled
                            ? 'bg-blue-600 bg-opacity-90 text-white hover:bg-opacity-100'
                            : 'bg-black bg-opacity-70 text-white hover:bg-opacity-90'
                        }`}
                        title={magnifyingGlassEnabled ? 'Disable magnifying glass' : 'Enable magnifying glass'}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                          />
                        </svg>
                        <span>Zoom</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-gray-400"
                >
                  <svg
                    className="mx-auto h-24 w-24 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-4 text-lg">No diagram uploaded</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upload New Button - Shows when diagram exists */}
          {diagramUrl && (
            <div className="p-4 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={onUploadNew}
                className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Upload New Diagram
              </button>
            </div>
          )}
        </Panel>

        {/* Resize Handle */}
        {diagramUrl && (
          <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-blue-500 transition-colors cursor-col-resize relative group">
            <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
              <div className="w-1 h-12 bg-gray-400 rounded-full group-hover:bg-blue-600 transition-colors"></div>
            </div>
          </PanelResizeHandle>
        )}

        {/* Right Panel - Bid Form */}
        {diagramUrl && (
          <Panel defaultSize={65} minSize={30} className="flex flex-col bg-gray-50">
            {/* Right Panel Header with Export Toolbar */}
            <div className="bg-white border-b px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">Bid Form</h2>
                </div>

                {/* Export Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={lineItems.length === 0}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    title="Export as PDF"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={lineItems.length === 0}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    title="Export as Excel"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={lineItems.length === 0}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    title="Export as CSV"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Bid Form Content */}
            <div className="flex-1 overflow-auto p-6">
              <AnimatePresence mode="wait">
                {isExtracting ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full"
                  >
                    <div className="relative">
                      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-blue-100 animate-pulse"></div>
                      </div>
                    </div>
                    <p className="mt-6 text-lg text-gray-700 font-medium">Processing diagram...</p>
                    <p className="mt-2 text-sm text-gray-500">Extracting bid items with AI</p>
                  </motion.div>
                ) : lineItems.length > 0 ? (
                  <motion.div
                    key="table"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <BidFormTable
                      initialLineItems={lineItems}
                      onUpdate={onLineItemsUpdate}
                      hoveredItemId={hoveredItemId}
                      onHoverChange={handleHoverChange}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-gray-400"
                  >
                    <div className="text-center">
                      <svg
                        className="mx-auto h-16 w-16 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="mt-4 text-lg">No bid items extracted</p>
                      <p className="mt-2 text-sm">Upload a diagram to get started</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>
        )}
      </PanelGroup>
    </div>
  );
}
