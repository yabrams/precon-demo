/**
 * ExtractionContainer Component
 *
 * Main orchestration component for the advanced extraction system.
 * Manages extraction session lifecycle, displays progress, and handles
 * the multi-page document viewer integration.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Package,
  Eye,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import ExtractionProgress from './ExtractionProgress';
import AIObservationsPanel from './AIObservationsPanel';
import { DocumentReferenceList } from './DocumentReferenceCard';
import dynamic from 'next/dynamic';
import {
  ExtractionSession,
  ExtractionConfig,
  ExtractionStatus,
  ExtractedWorkPackage,
  AIObservation,
  DocumentReference,
  DEFAULT_EXTRACTION_CONFIG,
} from '@/lib/extraction/types';
import { ProcessedPage } from '@/lib/pdf-utils';
import { ClassifiedDocument } from '@/lib/extraction/page-classifier';

// Dynamically import MultiPageViewer
const MultiPageViewer = dynamic(() => import('./MultiPageViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  ),
});

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionContainerProps {
  /** Project ID */
  projectId: string;
  /** Document IDs to extract from */
  documentIds: string[];
  /** Pre-processed pages (if available) */
  processedPages?: ProcessedPage[];
  /** Pre-classified document (if available) */
  classification?: ClassifiedDocument;
  /** Extraction configuration */
  config?: Partial<ExtractionConfig>;
  /** Called when extraction completes successfully */
  onComplete?: (session: ExtractionSession) => void;
  /** Called when user wants to close/cancel */
  onClose?: () => void;
  /** Custom class name */
  className?: string;
}

type ViewTab = 'progress' | 'results' | 'documents';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface WorkPackagePreviewProps {
  workPackage: ExtractedWorkPackage;
  onReferenceClick?: (ref: DocumentReference) => void;
  expanded?: boolean;
  onToggle?: () => void;
}

function WorkPackagePreview({
  workPackage,
  onReferenceClick,
  expanded,
  onToggle,
}: WorkPackagePreviewProps) {
  const confidenceColor =
    workPackage.extraction.confidence.overall >= 0.8
      ? 'text-green-600 bg-green-50'
      : workPackage.extraction.confidence.overall >= 0.5
      ? 'text-amber-600 bg-amber-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-gray-400" />
          <div className="text-left">
            <span className="font-medium text-gray-900">{workPackage.name}</span>
            <span className="text-sm text-gray-500 ml-2">
              ({workPackage.lineItems.length} items)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded ${confidenceColor}`}>
            {Math.round(workPackage.extraction.confidence.overall * 100)}%
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {workPackage.csiClassification.divisionCode}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3 border-t border-gray-200">
              {/* Description */}
              {workPackage.description && (
                <p className="text-sm text-gray-600">{workPackage.description}</p>
              )}

              {/* CSI Classification */}
              <div className="text-xs text-gray-500">
                <span className="font-medium">CSI:</span>{' '}
                {workPackage.csiClassification.divisionCode} -{' '}
                {workPackage.csiClassification.divisionName}
              </div>

              {/* Line items preview */}
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Line Items
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {workPackage.lineItems.slice(0, 10).map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400 w-6 text-right flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="text-gray-900">{item.description}</span>
                      {item.quantity && item.unit && (
                        <span className="text-gray-500 ml-auto flex-shrink-0">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                  ))}
                  {workPackage.lineItems.length > 10 && (
                    <p className="text-xs text-gray-400 mt-2">
                      + {workPackage.lineItems.length - 10} more items
                    </p>
                  )}
                </div>
              </div>

              {/* Key documents */}
              {workPackage.keyDocuments.length > 0 && (
                <DocumentReferenceList
                  references={workPackage.keyDocuments}
                  onNavigate={onReferenceClick}
                  maxVisible={3}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ExtractionContainer({
  projectId,
  documentIds,
  processedPages,
  classification,
  config,
  onComplete,
  onClose,
  className = '',
}: ExtractionContainerProps) {
  // State
  const [session, setSession] = useState<ExtractionSession | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('progress');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [extractionConfig, setExtractionConfig] = useState<ExtractionConfig>({
    ...DEFAULT_EXTRACTION_CONFIG,
    ...config,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedReference, setSelectedReference] = useState<DocumentReference | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start extraction
  const startExtraction = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/extraction/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          documentIds,
          config: extractionConfig,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start extraction');
      }

      const data = await response.json();

      // Initialize session with pending status
      setSession({
        id: data.sessionId,
        projectId,
        config: extractionConfig,
        documents: [],
        workPackages: [],
        observations: [],
        metrics: {
          totalWorkPackages: 0,
          totalLineItems: 0,
          totalObservations: 0,
          confidenceDistribution: { high: 0, medium: 0, low: 0 },
          csiDivisionsCovered: [],
          documentsProcessed: 0,
          pagesProcessed: 0,
          itemsNeedingReview: 0,
          criticalObservations: 0,
          warningObservations: 0,
        },
        passes: [],
        status: data.status,
        currentPass: 0,
        progress: 0,
        startedAt: new Date(),
      });

      // Start polling for updates
      startPolling(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [projectId, documentIds, extractionConfig]);

  // Poll for extraction status
  const startPolling = useCallback((sessionId: string) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/extraction/${sessionId}`);
        if (!response.ok) return;

        const data = await response.json();

        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status,
            currentPass: data.currentPass,
            progress: data.progress,
            statusMessage: data.statusMessage,
            workPackages: data.workPackages || prev.workPackages,
            observations: data.observations || prev.observations,
            metrics: data.metrics || prev.metrics,
            passes: data.passes || prev.passes,
            completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
            error: data.error,
          };
        });

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Switch to results tab on completion
          if (data.status === 'completed') {
            setActiveTab('results');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // Poll immediately, then every 2 seconds
    poll();
    pollIntervalRef.current = setInterval(poll, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Handle completion callback
  useEffect(() => {
    if (session?.status === 'completed' && onComplete) {
      onComplete(session);
    }
  }, [session?.status, session, onComplete]);

  // Toggle package expansion
  const togglePackage = useCallback((packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  }, []);

  // Handle observation actions
  const handleAcknowledgeObservation = useCallback(async (observationId: string) => {
    // TODO: API call to acknowledge
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        observations: prev.observations.map((obs) =>
          obs.id === observationId ? { ...obs, userAcknowledged: true } : obs
        ),
      };
    });
  }, []);

  const handleRespondToObservation = useCallback(
    async (observationId: string, response: string) => {
      // TODO: API call to save response
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          observations: prev.observations.map((obs) =>
            obs.id === observationId
              ? { ...obs, userResponse: response, userResponseAt: new Date() }
              : obs
          ),
        };
      });
    },
    []
  );

  const handleDismissObservation = useCallback(async (observationId: string) => {
    // TODO: API call to dismiss
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        observations: prev.observations.filter((obs) => obs.id !== observationId),
      };
    });
  }, []);

  // Handle reference navigation
  const handleReferenceClick = useCallback((ref: DocumentReference) => {
    setSelectedReference(ref);
    setActiveTab('documents');
  }, []);

  // Determine if extraction is in progress
  const isExtracting = Boolean(
    session &&
    !['completed', 'failed', 'awaiting_review'].includes(session.status)
  );

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Document Extraction</h2>
            {session && (
              <StatusBadge status={session.status} />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              disabled={isExtracting}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Start/Restart */}
            {!session || session.status === 'failed' ? (
              <button
                onClick={startExtraction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play className="h-4 w-4" />
                Start Extraction
              </button>
            ) : session.status === 'completed' ? (
              <button
                onClick={startExtraction}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Re-extract
              </button>
            ) : null}

            {/* Close */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {session && (
          <div className="flex items-center gap-1 mt-4">
            <TabButton
              active={activeTab === 'progress'}
              onClick={() => setActiveTab('progress')}
              icon={<Loader2 className="h-4 w-4" />}
              label="Progress"
              badge={isExtracting ? session.currentPass : undefined}
            />
            <TabButton
              active={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
              icon={<Package className="h-4 w-4" />}
              label="Results"
              badge={session.workPackages.length || undefined}
            />
            {(processedPages || classification) && (
              <TabButton
                active={activeTab === 'documents'}
                onClick={() => setActiveTab('documents')}
                icon={<FileText className="h-4 w-4" />}
                label="Documents"
              />
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex-shrink-0 mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Extraction Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* No session yet - show start prompt */}
          {!session && !error && (
            <motion.div
              key="start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center"
            >
              <div className="text-center max-w-md">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Ready to Extract
                </h3>
                <p className="text-gray-500 mb-6">
                  Click "Start Extraction" to begin the AI-powered document analysis.
                  The system will identify work packages, line items, and potential
                  issues across your documents.
                </p>
                <p className="text-sm text-gray-400">
                  {documentIds.length} document{documentIds.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </motion.div>
          )}

          {/* Progress tab */}
          {session && activeTab === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto p-6"
            >
              <ExtractionProgress
                sessionId={session.id}
                onComplete={(results) => {
                  // Update session with results
                  setSession((prev) => prev ? {
                    ...prev,
                    workPackages: results.workPackages,
                    observations: results.observations,
                    metrics: results.metrics,
                    passes: results.passes,
                    status: 'completed',
                  } : prev);
                  setActiveTab('results');
                }}
                onError={(errorMsg) => {
                  setError(errorMsg);
                }}
                onCancel={onClose}
              />
            </motion.div>
          )}

          {/* Results tab */}
          {session && activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Work packages */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      Work Packages ({session.workPackages.length})
                    </h3>
                    <span className="text-sm text-gray-500">
                      {session.metrics.totalLineItems} total line items
                    </span>
                  </div>

                  {session.workPackages.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {isExtracting
                        ? 'Extraction in progress...'
                        : 'No work packages extracted yet.'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {session.workPackages.map((pkg) => (
                        <WorkPackagePreview
                          key={pkg.id}
                          workPackage={pkg}
                          expanded={expandedPackages.has(pkg.id)}
                          onToggle={() => togglePackage(pkg.id)}
                          onReferenceClick={handleReferenceClick}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Observations sidebar */}
                <div>
                  <AIObservationsPanel
                    observations={session.observations}
                    onAcknowledge={handleAcknowledgeObservation}
                    onRespond={handleRespondToObservation}
                    onDismiss={handleDismissObservation}
                    onReferenceClick={handleReferenceClick}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Documents tab */}
          {session && activeTab === 'documents' && processedPages && classification && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <MultiPageViewer
                pages={processedPages}
                classification={classification}
                extractionProgress={session.progress}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusBadgeProps {
  status: ExtractionStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    ExtractionStatus,
    { label: string; className: string; icon?: React.ReactNode }
  > = {
    initializing: {
      label: 'Initializing',
      className: 'bg-gray-100 text-gray-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    pass_1_extracting: {
      label: 'Pass 1: Extracting',
      className: 'bg-blue-100 text-blue-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    pass_2_reviewing: {
      label: 'Pass 2: Reviewing',
      className: 'bg-blue-100 text-blue-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    pass_3_deep_dive: {
      label: 'Pass 3: Deep Dive',
      className: 'bg-blue-100 text-blue-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    pass_4_validating: {
      label: 'Pass 4: Validating',
      className: 'bg-purple-100 text-purple-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    pass_5_final: {
      label: 'Pass 5: Finalizing',
      className: 'bg-purple-100 text-purple-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    awaiting_review: {
      label: 'Awaiting Review',
      className: 'bg-amber-100 text-amber-700',
      icon: <Eye className="h-3 w-3" />,
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-700',
      icon: <CheckCircle className="h-3 w-3" />,
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700',
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${
          active
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }
      `}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span
          className={`
          px-1.5 py-0.5 text-xs rounded-full
          ${active ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}
        `}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
