'use client';

/**
 * Bid Package Workspace Component
 * Workspace for viewing and editing bid forms within a bid package
 * Similar to WorkspaceView but with bid package context
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import BidFormTable, { LineItem } from './BidFormTable';
import DiagramOverlay from './DiagramOverlay';
import ChatPanel from './ChatPanel';
import MagnifyingGlass from './MagnifyingGlass';
import SingleItemPanel, { SingleItemPanelRef } from './SingleItemPanel';
import { ChatMessage } from '@/types/chat';
import { BidPackage } from '@/types/bidPackage';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { Diagram } from '@/types/diagram';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useDiagramAutoFocus, getTransformStyle } from '@/hooks/useDiagramAutoFocus';

// Dynamically import PDFViewer to avoid SSR issues with pdf.js
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ),
});

type ViewMode = 'grid' | 'single';

interface UploadedFile {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

interface BidPackageWorkspaceProps {
  bidPackage: BidPackage;
  project: BuildingConnectedProject;
  projectDiagrams: Diagram[]; // Diagrams from parent project
  lineItems: LineItem[];
  isExtracting: boolean;
  onLineItemsUpdate: (items: LineItem[]) => void;
  onUploadNew: () => void;
  onUploadSuccess?: (file: UploadedFile) => void;
  onBack: () => void;
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  onChatToggle: () => void;
  onSendChatMessage: (message: string) => void;
  onAcceptChatChanges: (messageId: string) => void;
  onRejectChatChanges: (messageId: string) => void;
  isChatLoading?: boolean;
  onSubmitToReview?: () => void;
  onRecall?: () => void;
  onDeleteProject?: () => void;
}

export default function BidPackageWorkspace({
  bidPackage,
  project,
  projectDiagrams = [],
  lineItems = [],
  isExtracting,
  onLineItemsUpdate,
  onUploadNew,
  onUploadSuccess,
  onBack,
  chatOpen,
  chatMessages = [],
  onChatToggle,
  onSendChatMessage,
  onAcceptChatChanges,
  onRejectChatChanges,
  isChatLoading = false,
  onSubmitToReview,
  onRecall,
  onDeleteProject,
}: BidPackageWorkspaceProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredRowElement, setHoveredRowElement] = useState<HTMLTableRowElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [magnifyingGlassEnabled, setMagnifyingGlassEnabled] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [diagramContainerSize, setDiagramContainerSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const singleItemPanelRef = useRef<SingleItemPanelRef>(null);

  // All project diagrams are available to all bid packages
  // diagramIds can be used in the future for ordering or pinning specific diagrams
  const relevantDiagrams = projectDiagrams;

  // Current diagram being displayed
  const currentDiagram = selectedDiagramId
    ? relevantDiagrams.find(d => d.id === selectedDiagramId)
    : relevantDiagrams[0];

  const diagramUrl = currentDiagram?.fileUrl || null;

  // Check if current diagram is a PDF
  const isPDF = currentDiagram ?
    (currentDiagram.fileType === 'application/pdf' || currentDiagram.fileName.toLowerCase().endsWith('.pdf'))
    : false;

  // Update image dimensions and zoom level when image loads or on resize
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        setImageDimensions({ width, height });

        const naturalWidth = imageRef.current.naturalWidth;
        const naturalHeight = imageRef.current.naturalHeight;
        setImageNaturalSize({ width: naturalWidth, height: naturalHeight });

        if (naturalWidth > 0 && naturalHeight > 0) {
          const scaleX = width / naturalWidth;
          const scaleY = height / naturalHeight;
          const scale = Math.min(scaleX, scaleY);
          setZoomLevel(Math.round(scale * 100));
        }
      }
    };

    const img = imageRef.current;
    if (img) {
      img.addEventListener('load', updateImageDimensions);
      updateImageDimensions();
    }

    window.addEventListener('resize', updateImageDimensions);

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

  // Track diagram container size for auto-focus calculations
  useEffect(() => {
    if (!diagramContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDiagramContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(diagramContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [viewMode]);

  // Get current item for single view
  const currentItem = lineItems[currentItemIndex];
  const currentItemBoundingBox = currentItem?.boundingBox || null;

  // Auto-focus transform for single view
  const diagramTransform = useDiagramAutoFocus({
    boundingBox: currentItemBoundingBox,
    containerSize: diagramContainerSize,
    imageNaturalSize,
    enabled: viewMode === 'single',
  });

  // Navigation handlers for single view
  const handlePreviousItem = useCallback(() => {
    setCurrentItemIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextItem = useCallback(() => {
    setCurrentItemIndex((prev) => Math.min(lineItems.length - 1, prev + 1));
  }, [lineItems.length]);

  const handleApproveItem = useCallback(() => {
    if (!currentItem || lineItems.length === 0) return;
    const updated = [...lineItems];
    updated[currentItemIndex] = { ...updated[currentItemIndex], approved: !updated[currentItemIndex].approved };
    onLineItemsUpdate(updated);
  }, [currentItem, currentItemIndex, lineItems, onLineItemsUpdate]);

  const handleApproveAndNext = useCallback(() => {
    if (!currentItem || lineItems.length === 0) return;
    const updated = [...lineItems];
    updated[currentItemIndex] = { ...updated[currentItemIndex], approved: true };
    onLineItemsUpdate(updated);
    // Move to next item if not at the end
    if (currentItemIndex < lineItems.length - 1) {
      setCurrentItemIndex((prev) => prev + 1);
    }
  }, [currentItem, currentItemIndex, lineItems, onLineItemsUpdate]);

  const handleUpdateItem = useCallback((updatedItem: LineItem) => {
    const updated = [...lineItems];
    updated[currentItemIndex] = updatedItem;
    onLineItemsUpdate(updated);
  }, [currentItemIndex, lineItems, onLineItemsUpdate]);

  const handleExitSingleView = useCallback(() => {
    setViewMode('grid');
  }, []);

  const handleEnterFieldMode = useCallback(() => {
    singleItemPanelRef.current?.enterFieldMode();
  }, []);

  // Keyboard navigation for single view
  useKeyboardNavigation({
    enabled: viewMode === 'single',
    onPrevious: handlePreviousItem,
    onNext: handleNextItem,
    onApprove: handleApproveItem,
    onApproveAndNext: handleApproveAndNext,
    onExitSingleView: handleExitSingleView,
    onEnterFieldMode: handleEnterFieldMode,
  });

  // Reset current item index when switching to single view or when items change
  useEffect(() => {
    if (currentItemIndex >= lineItems.length && lineItems.length > 0) {
      setCurrentItemIndex(lineItems.length - 1);
    }
  }, [lineItems.length, currentItemIndex]);

  const hoveredItem = lineItems.find((item) => item.id === hoveredItemId);

  // Direct file upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadedData = await uploadResponse.json();

      // Pass uploaded file data to parent component
      if (onUploadSuccess) {
        onUploadSuccess(uploadedData);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    }

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bidding':
        return 'bg-zinc-50 text-zinc-800 border border-zinc-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'awarded':
        return 'bg-zinc-50 text-zinc-800 border border-zinc-200';
      case 'draft':
        return 'bg-gray-50 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  return (
    <div ref={workspaceRef} className="h-full flex flex-col bg-gray-50 relative">
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
        className={`fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full shadow-md transition-all flex items-center justify-center font-medium text-2xl ${
          chatOpen
            ? 'bg-gray-600 hover:bg-gray-700 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
        }`}
        title={chatOpen ? 'Close AI Chat' : 'Open AI Chat'}
      >
        💬
      </button>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-zinc-900">{bidPackage.name}</h1>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                    bidPackage.status
                  )}`}
                >
                  {bidPackage.status}
                </span>
              </div>
              {project.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-md">{project.description}</p>
              )}
            </div>
          </div>

          {/* Center: Progress Bar */}
          {lineItems.length > 0 && (() => {
            const approvedItems = lineItems.filter(item => item.approved === true).length;
            const totalItems = lineItems.length;
            const percentage = totalItems > 0 ? Math.round((approvedItems / totalItems) * 100) : 0;

            return (
              <div className="flex-1 max-w-xs mx-8">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Progress</span>
                    <span className="text-xs font-semibold text-zinc-900">{approvedItems}/{totalItems}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        percentage === 100 ? 'bg-emerald-500' : 'bg-zinc-900'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Right side: View toggles */}
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            {lineItems.length > 0 && (
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Grid view"
                >
                  ▦
                </button>
                <button
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-2 text-lg transition-colors ${
                    viewMode === 'single'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Single item view"
                >
                  ◻️
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {!diagramUrl && lineItems.length === 0 ? (
          // Empty state
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 mb-2">No Diagram Yet</h3>
              <p className="text-gray-600 mb-6">
                Upload a construction diagram to start extracting bid items
              </p>
              <input
                type="file"
                id="diagram-upload-workspace-empty"
                className="hidden"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="diagram-upload-workspace-empty"
                className="inline-flex items-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-md shadow-zinc-900/10 transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload Diagram
              </label>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View: Workspace with panels
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Diagram Viewer */}
            <Panel defaultSize={35} minSize={20} className="relative bg-white border-r border-gray-200">
              <div className="h-full flex flex-col">
                {/* Diagram Container */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4 relative">
                  {diagramUrl ? (
                    isPDF ? (
                      // PDF Viewer
                      <div className="h-full">
                        <PDFViewer
                          documents={{
                            url: diagramUrl,
                            fileName: currentDiagram?.fileName || 'Document.pdf'
                          }}
                          className="h-full"
                        />
                      </div>
                    ) : (
                      // Image Viewer with Overlays
                      <>
                        <img
                          ref={imageRef}
                          src={diagramUrl}
                          alt="Construction diagram"
                          className="max-w-full h-auto mx-auto object-contain"
                        />
                        {/* Bounding Box Overlay */}
                        {lineItems.some(item => item.boundingBox) && imageDimensions.width > 0 && (
                          <DiagramOverlay
                            lineItems={lineItems}
                            hoveredItemId={hoveredItemId}
                            onHoverChange={(id) => setHoveredItemId(id)}
                            imageWidth={imageDimensions.width}
                            imageHeight={imageDimensions.height}
                          />
                        )}
                        {/* Magnifying Glass */}
                        {magnifyingGlassEnabled && diagramUrl && (
                          <MagnifyingGlass imageRef={imageRef as React.RefObject<HTMLImageElement>} imageSrc={diagramUrl} enabled={magnifyingGlassEnabled} />
                        )}
                      </>
                    )
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No diagram available
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors cursor-col-resize" />

            {/* Right Panel: Bid Form Table */}
            <Panel defaultSize={65} minSize={30}>
              <BidFormTable
                initialLineItems={lineItems}
                onUpdate={onLineItemsUpdate}
                hoveredItemId={hoveredItemId}
                onHoverChange={(itemId, rowElement) => {
                  setHoveredItemId(itemId);
                  setHoveredRowElement(rowElement ?? null);
                }}
                readOnly={bidPackage.status === 'pending-review' || bidPackage.status === 'bidding' || bidPackage.status === 'bidding-leveling' || bidPackage.status === 'awarded'}
              />
            </Panel>
          </PanelGroup>
        ) : (
          // Single Item View: Full-width diagram + bottom panel
          <div className="h-full flex flex-col">
            {/* Full-width Diagram Area */}
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              {/* Diagram Container - Full Width with Auto-Zoom */}
              <div
                ref={diagramContainerRef}
                className="flex-1 overflow-hidden bg-gray-50 relative flex items-center justify-center p-4"
              >
                {diagramUrl ? (
                  isPDF ? (
                    // PDF Viewer
                    <div className="w-full h-full">
                      <PDFViewer
                        documents={{
                          url: diagramUrl,
                          fileName: currentDiagram?.fileName || 'Document.pdf'
                        }}
                        className="h-full"
                      />
                    </div>
                  ) : (
                    // Image Viewer with Auto-Zoom and Overlays
                    <div
                      className="relative w-full h-full flex items-center justify-center"
                      style={getTransformStyle(diagramTransform)}
                    >
                      <img
                        ref={imageRef}
                        src={diagramUrl}
                        alt="Construction diagram"
                        className="w-full h-full object-contain"
                      />
                      {/* Bounding Box Overlay for current item */}
                      {currentItem?.boundingBox && imageDimensions.width > 0 && (
                        <DiagramOverlay
                          lineItems={[currentItem]}
                          hoveredItemId={currentItem.id || null}
                          onHoverChange={() => {}}
                          imageWidth={imageDimensions.width}
                          imageHeight={imageDimensions.height}
                        />
                      )}
                      {/* Magnifying Glass */}
                      {magnifyingGlassEnabled && diagramUrl && (
                        <MagnifyingGlass imageRef={imageRef as React.RefObject<HTMLImageElement>} imageSrc={diagramUrl} enabled={magnifyingGlassEnabled} />
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-gray-500">No diagram available</div>
                )}
              </div>
            </div>

            {/* Single Item Panel at Bottom */}
            {currentItem && (
              <SingleItemPanel
                ref={singleItemPanelRef}
                item={currentItem}
                itemIndex={currentItemIndex}
                totalItems={lineItems.length}
                onUpdate={handleUpdateItem}
                onApprove={handleApproveItem}
                onApproveAndNext={handleApproveAndNext}
                onPrevious={handlePreviousItem}
                onNext={handleNextItem}
                readOnly={bidPackage.status === 'pending-review' || bidPackage.status === 'bidding' || bidPackage.status === 'bidding-leveling' || bidPackage.status === 'awarded'}
                allLineItems={lineItems}
                bidPackageStatus={bidPackage.status}
                onCompleted={
                  bidPackage.status !== 'pending-review' &&
                  bidPackage.status !== 'bidding' &&
                  bidPackage.status !== 'bidding-leveling' &&
                  bidPackage.status !== 'awarded'
                    ? onSubmitToReview
                    : undefined
                }
                onRecall={bidPackage.status === 'pending-review' ? onRecall : undefined}
              />
            )}
          </div>
        )}
      </div>


      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                    Delete Project
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to delete this project? This action cannot be undone.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        if (onDeleteProject) {
                          onDeleteProject();
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
