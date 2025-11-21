'use client';

/**
 * DocumentReviewPanel Component
 * Shows AI categorization suggestions for uploaded documents
 * Allows users to review and confirm or modify the suggested category
 */

import { useState } from 'react';
import Image from 'next/image';

interface DocumentReviewPanelProps {
  diagram: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  };
  categorization: {
    category: string;
    confidence: number;
    reasoning: string;
    alternativeCategories: string[];
  };
  onConfirm: (selectedCategory: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
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

export default function DocumentReviewPanel({
  diagram,
  categorization,
  onConfirm,
  onCancel,
  isProcessing = false
}: DocumentReviewPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState(categorization.category);
  const confidencePercent = Math.round(categorization.confidence * 100);

  const isImage = diagram.fileType.startsWith('image/');
  const allCategories = [
    categorization.category,
    ...categorization.alternativeCategories
  ].filter((cat, index, self) => self.indexOf(cat) === index); // Remove duplicates

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Review Document Category
              </h2>
              <p className="text-slate-400 text-sm">
                AI has analyzed your document. Please review and confirm the suggested category.
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Document Info */}
          <div className="flex items-start space-x-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
            {isImage ? (
              <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
                <Image
                  src={diagram.fileUrl}
                  alt={diagram.fileName}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-slate-800 flex items-center justify-center">
                <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{diagram.fileName}</h3>
              <p className="text-slate-400 text-sm">
                {(diagram.fileSize / 1024 / 1024).toFixed(2)} MB · {diagram.fileType}
              </p>
            </div>
          </div>

          {/* AI Suggestion */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">AI Suggested Category</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">Confidence:</span>
                <span className={`text-sm font-semibold ${getConfidenceColor(categorization.confidence)}`}>
                  {getConfidenceLabel(categorization.confidence)} ({confidencePercent}%)
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${CATEGORY_COLORS[categorization.category] || 'bg-slate-800/50 border-slate-700 text-slate-300'}`}>
              <div className="font-semibold text-lg mb-2">{categorization.category}</div>
              <p className="text-sm opacity-90">{categorization.reasoning}</p>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Select Category</h3>
            <div className="grid grid-cols-2 gap-3">
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

          {/* Alternative Categories */}
          {categorization.alternativeCategories.length > 0 && (
            <div className="text-sm text-slate-400">
              <span className="font-medium">Alternative suggestions:</span>{' '}
              {categorization.alternativeCategories.join(', ')}
            </div>
          )}
        </div>

        {/* Footer */}
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
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>Confirm & Create Bid Package</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
