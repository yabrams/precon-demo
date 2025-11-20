'use client';

import { useState } from 'react';
import { CSIMappingResponse } from '@/types/csi';

interface CSIAIMatchTabProps {
  onSelectCode: (code: string, title: string) => void;
}

export default function CSIAIMatchTab({ onSelectCode }: CSIAIMatchTabProps) {
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [maxMatches, setMaxMatches] = useState(5);
  const [result, setResult] = useState<CSIMappingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemDescription.trim()) {
      setError('Please enter an item description');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/csi/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemDescription: itemDescription.trim(),
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: unit.trim() || undefined,
          notes: notes.trim() || undefined,
          maxMatches,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI matching failed');
      }

      const data: CSIMappingResponse = await response.json();
      setResult(data);
    } catch (err) {
      console.error('AI matching error:', err);
      setError(err instanceof Error ? err.message : 'Failed to match item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setItemDescription('');
    setQuantity('');
    setUnit('');
    setNotes('');
    setResult(null);
    setError(null);
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-300';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.5) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className="p-4 space-y-4">
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Item Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="e.g., Cast-in-place concrete foundation walls, 3000 psi"
            rows={3}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Describe the construction item in detail
          </p>
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity (Optional)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="150"
              step="0.01"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit (Optional)
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="CY, SF, EA..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional specifications or context..."
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
            disabled={isLoading}
          />
        </div>

        {/* Max Matches */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Matches: {maxMatches}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={maxMatches}
            onChange={(e) => setMaxMatches(parseInt(e.target.value))}
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading || !itemDescription.trim()}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Find Matching Codes
              </>
            )}
          </button>
          {(itemDescription || result) && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Overall Confidence */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Analysis Result</h3>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  result.overallConfidence === 'high'
                    ? 'bg-green-100 text-green-700'
                    : result.overallConfidence === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Found {result.matchCount} matching {result.matchCount === 1 ? 'code' : 'codes'}{' '}
              for: <span className="font-medium">{result.itemDescription}</span>
            </p>
          </div>

          {/* Matches */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Matched Codes</h4>
            {result.matches.map((match, index) => (
              <button
                key={match.code}
                onClick={() => onSelectCode(match.code, match.title)}
                className="w-full text-left p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-bold text-blue-600 group-hover:text-blue-700">
                        {match.code}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Level {match.level}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded border ${getConfidenceBadgeColor(
                          match.confidence
                        )}`}
                      >
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900 mb-2">
                      {match.title}
                    </p>
                    <div className="bg-blue-50 rounded p-2 mb-2">
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold">AI Reasoning:</span> {match.reasoning}
                      </p>
                    </div>
                    {match.breadcrumb.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {match.breadcrumb.join(' › ')}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !isLoading && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">AI-Powered Code Matching</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            Describe your construction item and let AI find the most appropriate CSI codes with
            confidence scores and reasoning.
          </p>
        </div>
      )}
    </div>
  );
}
