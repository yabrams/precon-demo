'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CSISearchTab from './CSISearchTab';
import CSIBrowseTab from './CSIBrowseTab';

interface CSIWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCode?: (code: string, title: string) => void;
}

type TabType = 'search' | 'browse';

export default function CSIWidget({ isOpen, onClose, onSelectCode }: CSIWidgetProps) {
  const [activeTab, setActiveTab] = useState<TabType>('search');

  const handleSelectCode = (code: string, title: string) => {
    if (onSelectCode) {
      onSelectCode(code, title);
    }
    // Optionally close widget after selection
    // onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-50"
          />

          {/* Widget Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="border-2 border-gray-200 p-2 rounded-lg bg-gray-50">
                  <svg
                    className="w-6 h-6 text-zinc-900"
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
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">CSI MasterFormat</h2>
                  <p className="text-sm text-gray-600">2018 Edition</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-zinc-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'search'
                    ? 'bg-white text-zinc-900 border-b-2 border-zinc-900'
                    : 'bg-gray-50 text-gray-600 hover:text-zinc-900 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Search
                </div>
              </button>
              <button
                onClick={() => setActiveTab('browse')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'browse'
                    ? 'bg-white text-zinc-900 border-b-2 border-zinc-900'
                    : 'bg-gray-50 text-gray-600 hover:text-zinc-900 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  Browse
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'search' && <CSISearchTab onSelectCode={handleSelectCode} />}
              {activeTab === 'browse' && <CSIBrowseTab onSelectCode={handleSelectCode} />}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono">CSI MasterFormat 2018</span>
                <span>Construction Specifications Institute</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
