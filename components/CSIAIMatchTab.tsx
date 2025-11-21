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
    if (confidence >= 0.8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (confidence >= 0.5) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
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
          <label className="block text-sm font-medium text-white mb-2">
            Item Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="e.g., Cast-in-place concrete foundation walls, 3000 psi"
            rows={3}
            className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white placeholder-slate-500"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-slate-500">
            Describe the construction item in detail
          </p>
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Quantity (Optional)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="150"
              step="0.01"
              className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white placeholder-slate-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Unit (Optional)
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="CY, SF, EA..."
              className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white placeholder-slate-500"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional specifications or context..."
            className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white placeholder-slate-500"
            disabled={isLoading}
          />
        </div>

        {/* Max Matches */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Maximum Matches: <span className="font-mono text-cyan-400">{maxMatches}</span>
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={maxMatches}
            onChange={(e) => setMaxMatches(parseInt(e.target.value))}
            className="w-full accent-violet-600"
            disabled={isLoading}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading || !itemDescription.trim()}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg hover:from-violet-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2"
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
                AI Match
              </>
            )}
          </button>
          {(itemDescription || result) && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white disabled:bg-slate-900 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Overall Confidence */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Analysis Result</h3>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border font-mono ${
                  result.overallConfidence === 'high'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    : result.overallConfidence === 'medium'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                    : 'bg-slate-500/20 text-slate-400 border-slate-500/50'
                }`}
              >
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Found <span className="font-mono text-cyan-400">{result.matchCount}</span> matching {result.matchCount === 1 ? 'code' : 'codes'}{' '}
              for: <span className="font-medium text-white">{result.itemDescription}</span>
            </p>
          </div>

          {/* Matches */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Matched Codes</h4>
            {result.matches.map((match, index) => (
              <button
                key={match.code}
                onClick={() => onSelectCode(match.code, match.title)}
                className="w-full text-left p-4 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-lg hover:border-cyan-500/50 hover:shadow-xl transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-bold text-cyan-400 group-hover:text-cyan-300">
                        {match.code}
                      </span>
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded border border-cyan-500/50">
                        Level {match.level}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded border font-mono ${getConfidenceBadgeColor(
                          match.confidence
                        )}`}
                      >
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white mb-2">
                      {match.title}
                    </p>
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-2 mb-2">
                      <p className="text-xs text-slate-300">
                        <span className="font-semibold text-cyan-400">AI Reasoning:</span> {match.reasoning}
                      </p>
                    </div>
                    {match.breadcrumb.length > 0 && (
                      <p className="text-xs text-slate-500 font-mono">
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
          <div className="inline-block p-4 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-cyan-500/50 rounded-xl mb-4">
            <svg
              className="h-12 w-12 text-cyan-500"
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
          </div>
          <h3 className="mt-4 text-sm font-medium text-white">AI-Powered Code Matching</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Describe your construction item and let AI find the most appropriate CSI codes with
            confidence scores and reasoning.
          </p>
        </div>
      )}
    </div>
  );
}
