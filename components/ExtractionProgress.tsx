/**
 * ExtractionProgress Component
 *
 * Displays real-time progress of an extraction session.
 * Polls the API for status updates and shows pass-by-pass progress.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExtractionStatusResponse,
  ExtractionResultsResponse,
  ExtractionStatus,
} from '@/lib/extraction/types';

interface ExtractionProgressProps {
  sessionId: string;
  onComplete?: (results: ExtractionResultsResponse) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

interface LiveFeedItem {
  id: string;
  type: 'item' | 'observation' | 'status';
  message: string;
  timestamp: Date;
}

const PASS_LABELS: Record<number, { title: string; description: string }> = {
  1: {
    title: 'Initial Extraction',
    description: 'Extracting work packages from documents',
  },
  2: {
    title: 'Self-Review',
    description: 'Checking for missed items',
  },
  3: {
    title: 'Trade Deep-Dive',
    description: 'Detailed analysis of specific trades',
  },
  4: {
    title: 'Cross-Validation',
    description: 'Validating with secondary model',
  },
  5: {
    title: 'Final Quality Check',
    description: 'Final validation and observations',
  },
};

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  in_progress: '→',
  pending: '○',
  failed: '✕',
};

export default function ExtractionProgress({
  sessionId,
  onComplete,
  onError,
  onCancel,
}: ExtractionProgressProps) {
  const [status, setStatus] = useState<ExtractionStatusResponse | null>(null);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  // Poll for status updates
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/extraction/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data: ExtractionStatusResponse = await response.json();
      setStatus(data);

      // Add status message to feed
      if (data.statusMessage) {
        addToFeed('status', data.statusMessage);
      }

      // Check if completed or failed
      if (data.status === 'completed') {
        setPolling(false);
        // Fetch full results
        const resultsResponse = await fetch(
          `/api/extraction/${sessionId}?results=true`
        );
        if (resultsResponse.ok) {
          const results: ExtractionResultsResponse = await resultsResponse.json();
          onComplete?.(results);
        }
      } else if (data.status === 'failed') {
        setPolling(false);
        setError('Extraction failed');
        onError?.('Extraction failed');
      }
    } catch (err) {
      console.error('Status fetch error:', err);
      setError('Failed to fetch extraction status');
    }
  }, [sessionId, onComplete, onError]);

  const addToFeed = (type: LiveFeedItem['type'], message: string) => {
    setLiveFeed(prev => {
      // Avoid duplicates
      if (prev.length > 0 && prev[prev.length - 1].message === message) {
        return prev;
      }
      const newItem: LiveFeedItem = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date(),
      };
      // Keep last 10 items
      return [...prev.slice(-9), newItem];
    });
  };

  // Poll for status updates
  useEffect(() => {
    if (!polling) return;

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const getPassStatus = (passNumber: number): 'completed' | 'in_progress' | 'pending' => {
    if (!status) return 'pending';
    if (status.currentPass > passNumber) return 'completed';
    if (status.currentPass === passNumber) return 'in_progress';
    return 'pending';
  };

  const getPassIcon = (passNumber: number): string => {
    const passStatus = getPassStatus(passNumber);
    return STATUS_ICONS[passStatus];
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Extraction Error</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Extracting Work Packages
          </h3>
          <span className="text-2xl font-bold text-blue-600">
            {status?.progress || 0}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${status?.progress || 0}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Pass Progress */}
      <div className="px-6 py-4 space-y-3">
        {[1, 2, 3, 4, 5].map(passNumber => {
          const passStatus = getPassStatus(passNumber);
          const passInfo = PASS_LABELS[passNumber];

          return (
            <div
              key={passNumber}
              className={`flex items-start gap-3 ${
                passStatus === 'pending' ? 'opacity-50' : ''
              }`}
            >
              <span
                className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium ${
                  passStatus === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : passStatus === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {getPassIcon(passNumber)}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    passStatus === 'in_progress'
                      ? 'text-blue-700'
                      : 'text-gray-900'
                  }`}
                >
                  Pass {passNumber}: {passInfo.title}
                </p>
                <p className="text-sm text-gray-500">{passInfo.description}</p>

                {/* Show metrics for completed passes */}
                {passStatus === 'completed' && status?.metrics && (
                  <p className="text-sm text-green-600 mt-1">
                    {passNumber === 1 && `${status.metrics.totalWorkPackages} packages found`}
                    {passNumber === 2 && 'Review complete'}
                    {passNumber === 3 && 'Trade analysis complete'}
                    {passNumber === 4 && 'Validation complete'}
                    {passNumber === 5 && `${status.metrics.totalObservations} observations`}
                  </p>
                )}

                {/* Loading animation for in-progress */}
                {passStatus === 'in_progress' && (
                  <div className="flex items-center gap-1 mt-1">
                    <motion.span
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <motion.span
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.span
                      className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Feed */}
      <div className="px-6 py-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Live Feed</h4>
        <div className="bg-gray-50 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs">
          <AnimatePresence mode="popLayout">
            {liveFeed.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-1 ${
                  item.type === 'observation'
                    ? 'text-amber-600'
                    : item.type === 'item'
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                <span className="text-gray-400">
                  {item.timestamp.toLocaleTimeString()}
                </span>{' '}
                {item.type === 'item' && '• Found: '}
                {item.type === 'observation' && '⚠ '}
                {item.message}
              </motion.div>
            ))}
          </AnimatePresence>

          {liveFeed.length === 0 && (
            <p className="text-gray-400">Waiting for extraction to start...</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
