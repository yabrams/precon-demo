'use client';

/**
 * Bid Package Workspace Component
 * Workspace for viewing and editing bid forms within a bid package
 * Similar to WorkspaceView but with bid package context
 */

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import BidFormTable, { LineItem } from './BidFormTable';
import DiagramOverlay from './DiagramOverlay';
import ChatPanel from './ChatPanel';
import MagnifyingGlass from './MagnifyingGlass';
import { ChatMessage } from '@/types/chat';
import { BidPackage } from '@/types/bidPackage';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { Diagram } from '@/types/diagram';

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
}: BidPackageWorkspaceProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredRowElement, setHoveredRowElement] = useState<HTMLTableRowElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [magnifyingGlassEnabled, setMagnifyingGlassEnabled] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // All project diagrams are available to all bid packages
  // diagramIds can be used in the future for ordering or pinning specific diagrams
  const relevantDiagrams = projectDiagrams;

  // Current diagram being displayed
  const currentDiagram = selectedDiagramId
    ? relevantDiagrams.find(d => d.id === selectedDiagramId)
    : relevantDiagrams[0];

  const diagramUrl = currentDiagram?.fileUrl || null;

  // Update image dimensions and zoom level when image loads or on resize
  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current) {
        const { width, height } = imageRef.current.getBoundingClientRect();
        setImageDimensions({ width, height });

        const naturalWidth = imageRef.current.naturalWidth;
        const naturalHeight = imageRef.current.naturalHeight;

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
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'active':
        return 'bg-green-500/10 text-green-400 border border-green-500/30';
      case 'awarded':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      case 'draft':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
    }
  };

  return (
    <div ref={workspaceRef} className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-sm text-slate-400 hover:text-white transition-colors"
            >
              <svg
                className="h-4 w-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-white">{bidPackage.name}</h1>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                    bidPackage.status
                  )}`}
                >
                  {bidPackage.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">{project.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Magnifying Glass Toggle */}
            {diagramUrl && (
              <button
                onClick={() => setMagnifyingGlassEnabled(!magnifyingGlassEnabled)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  magnifyingGlassEnabled
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                    : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
                }`}
                title={magnifyingGlassEnabled ? 'Disable Magnifier' : 'Enable Magnifier'}
              >
                <svg
                  className="h-4 w-4"
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
              </button>
            )}

            {/* Upload New Diagram */}
            <button
              onClick={onUploadNew}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg text-sm transition-colors"
            >
              Upload Diagram
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Package Progress</span>
            <span className="font-medium font-mono">{bidPackage.progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-violet-600 to-cyan-600 h-1.5 rounded-full transition-all"
              style={{ width: `${bidPackage.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {!diagramUrl && lineItems.length === 0 ? (
          // Empty state
          <div className="h-full flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-slate-400"
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
              <h3 className="text-lg font-medium text-white mb-2">No Diagram Yet</h3>
              <p className="text-slate-400 mb-6">
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
                className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-lg shadow-violet-900/20 transition-colors cursor-pointer"
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
        ) : (
          // Workspace with panels
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Diagram Viewer */}
            <Panel defaultSize={35} minSize={20} className="relative bg-slate-900/60 backdrop-blur-md border-r border-slate-800">
              <div className="h-full flex flex-col">
                {/* Diagram Info Bar */}
                <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-300">Diagram</span>
                    {relevantDiagrams.length > 1 && (
                      <select
                        value={selectedDiagramId || relevantDiagrams[0]?.id || ''}
                        onChange={(e) => setSelectedDiagramId(e.target.value)}
                        className="text-xs border border-slate-700 rounded-lg px-2 py-1 bg-slate-800 text-slate-100 max-w-xs truncate"
                      >
                        {relevantDiagrams.map((diagram) => (
                          <option key={diagram.id} value={diagram.id}>
                            {diagram.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                    {relevantDiagrams.length === 1 && currentDiagram && (
                      <span className="text-xs text-slate-400 truncate">
                        {currentDiagram.fileName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 ml-2 font-mono">Zoom: {zoomLevel}%</span>
                </div>

                {/* Diagram Container */}
                <div className="flex-1 overflow-auto bg-slate-950 p-4 relative">
                  {diagramUrl ? (
                    <>
                      <img
                        ref={imageRef}
                        src={diagramUrl}
                        alt="Construction diagram"
                        className="max-w-full h-auto mx-auto object-contain"
                      />
                      {/* Bounding Box Overlay */}
                      {hoveredItem?.boundingBox && (
                        <DiagramOverlay
                          imageRef={imageRef}
                          boundingBox={hoveredItem.boundingBox}
                          isHovered={true}
                        />
                      )}
                      {/* Magnifying Glass */}
                      {magnifyingGlassEnabled && (
                        <MagnifyingGlass imageRef={imageRef} imageUrl={diagramUrl} />
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      No diagram available
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-violet-500 transition-colors cursor-col-resize" />

            {/* Right Panel: Bid Form Table or Chat */}
            <Panel defaultSize={65} minSize={30}>
              {chatOpen ? (
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={onSendChatMessage}
                  onAcceptChanges={onAcceptChatChanges}
                  onRejectChanges={onRejectChatChanges}
                  onClose={onChatToggle}
                  isLoading={isChatLoading}
                />
              ) : (
                <BidFormTable
                  initialLineItems={lineItems}
                  onUpdate={onLineItemsUpdate}
                  hoveredItemId={hoveredItemId}
                  onHoverChange={(itemId, rowElement) => {
                    setHoveredItemId(itemId);
                    setHoveredRowElement(rowElement);
                  }}
                />
              )}
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
