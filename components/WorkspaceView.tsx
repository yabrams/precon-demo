'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import BidFormTable, { LineItem } from './BidFormTable';
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export';

interface WorkspaceViewProps {
  diagramUrl: string | null;
  lineItems: LineItem[];
  projectName: string;
  isExtracting: boolean;
  onLineItemsUpdate: (items: LineItem[]) => void;
  onProjectNameChange: (name: string) => void;
  onUploadNew: () => void;
}

export default function WorkspaceView({
  diagramUrl,
  lineItems,
  projectName,
  isExtracting,
  onLineItemsUpdate,
  onProjectNameChange,
  onUploadNew,
}: WorkspaceViewProps) {
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    if (format === 'pdf') {
      exportToPDF(lineItems, projectName);
    } else if (format === 'excel') {
      exportToExcel(lineItems, projectName);
    } else if (format === 'csv') {
      exportToCSV(lineItems);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <PanelGroup direction="horizontal">
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
                  <img
                    src={diagramUrl}
                    alt="Construction Diagram"
                    className="max-w-full max-h-full object-contain shadow-lg rounded"
                  />
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Bid Form</h2>

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

              {/* Project Name Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => onProjectNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900 font-medium shadow-sm"
                  placeholder="Enter project name"
                />
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
