'use client';

/**
 * CSI MasterFormat View
 * Full-screen view for browsing and searching CSI MasterFormat codes
 */

import { useState } from 'react';
import CSISearchTab from './CSISearchTab';
import CSIBrowseTab from './CSIBrowseTab';

type TabType = 'search' | 'browse';

export default function CSIMasterFormatView() {
  const [activeTab, setActiveTab] = useState<TabType>('search');

  const handleSelectCode = (code: string, title: string) => {
    console.log('CSI code selected:', code, title);
    // Could add clipboard copy or other functionality here
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
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
            <h1 className="text-xl font-bold text-zinc-900">CSI MasterFormat</h1>
            <p className="text-sm text-gray-600">2018 Edition</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'search'
              ? 'text-zinc-900 border-b-2 border-zinc-900'
              : 'text-gray-600 hover:text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
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
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'browse'
              ? 'text-zinc-900 border-b-2 border-zinc-900'
              : 'text-gray-600 hover:text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
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
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-mono">CSI MasterFormat 2018</span>
          <span>Construction Specifications Institute</span>
        </div>
      </div>
    </div>
  );
}
