'use client';

/**
 * DocumentReviewView Component
 * Split layout showing document preview on left and categorization review on right
 */

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface Diagram {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

interface Categorization {
  category: string;
  confidence: number;
  reasoning: string;
  alternativeCategories: string[];
}

interface DocumentReviewViewProps {
  diagram: Diagram;
  categorization: Categorization | null;
  isProcessing: boolean;
  onConfirm: (selectedCategory: string) => void;
  onCancel: () => void;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  'STRUCTURAL STEEL': 'bg-red-500/10 border-red-500/30 text-red-400',
  'CONCRETE': 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  'MEP': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  'SITE WORK': 'bg-green-500/10 border-green-500/30 text-green-400',
  'ARCHITECTURAL FINISHES': 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  'SPECIALTY ITEMS': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  'GENERAL REQUIREMENTS': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'text-green-400';
  if (confidence >= 0.7) return 'text-yellow-400';
  if (confidence >= 0.5) return 'text-orange-400';
  return 'text-red-400';
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Moderate';
  return 'Low';
};

export default function DocumentReviewView({
  diagram,
  categorization,
  isProcessing,
  onConfirm,
  onCancel,
}: DocumentReviewViewProps) {
  const [selectedCategory, setSelectedCategory] = useState(categorization?.category || '');

  const isImage = diagram.fileType.startsWith('image/');
  const allCategories = categorization
    ? [categorization.category, ...categorization.alternativeCategories].filter(
        (cat, index, self) => self.indexOf(cat) === index
      )
    : [];

  return (
    <div className="h-full flex bg-slate-950">
      {/* Left Panel - Document Preview */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 bg-slate-900 flex flex-col"
      >
        {/* Document Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{diagram.fileName}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {(diagram.fileSize / 1024 / 1024).toFixed(2)} MB · {diagram.fileType}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white transition-colors"
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
        </div>

        {/* Document Preview */}
        <div className="flex-1 p-6 overflow-auto flex items-center justify-center">
          {isImage ? (
            <img
              src={diagram.fileUrl}
              alt={diagram.fileName}
              className="max-w-full max-h-full object-contain shadow-lg rounded"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg font-medium">Document Preview</p>
              <p className="text-sm">{diagram.fileType}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Right Panel - Categorization Review or Loading */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="w-[500px] bg-slate-900 border-l border-slate-800 flex flex-col"
      >
        {isProcessing ? (
          // Loading State
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-violet-600 mb-6"></div>
            <h3 className="text-xl font-bold text-white mb-2">Analyzing Document</h3>
            <p className="text-slate-400 text-center">
              AI is categorizing your document based on construction trade and content...
            </p>
          </div>
        ) : categorization ? (
          // Categorization Review
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white mb-2">Review Category</h2>
              <p className="text-slate-400 text-sm">
                AI has analyzed your document. Review and confirm the suggested category.
              </p>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Suggestion */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">AI Suggested Category</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-400">Confidence:</span>
                    <span className={`text-sm font-semibold ${getConfidenceColor(categorization.confidence)}`}>
                      {getConfidenceLabel(categorization.confidence)} (
                      {Math.round(categorization.confidence * 100)}%)
                    </span>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${
                    CATEGORY_COLORS[categorization.category] ||
                    'bg-slate-800/50 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-lg mb-2">{categorization.category}</div>
                  <p className="text-sm opacity-90">{categorization.reasoning}</p>
                </div>
              </div>

              {/* Category Selection */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Select Category</h3>
                <div className="grid grid-cols-1 gap-3">
                  {allCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      disabled={isProcessing}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedCategory === category
                          ? CATEGORY_COLORS[category] || 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-950/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="font-medium">{category}</div>
                      {category === categorization.category && (
                        <div className="text-xs mt-1 opacity-75">Recommended</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="px-6 py-2 text-slate-300 hover:text-white border border-slate-700 rounded-lg hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(selectedCategory)}
                disabled={isProcessing || !selectedCategory}
                className="px-8 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center space-x-2"
              >
                <span>Confirm & Create Bid Package</span>
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
