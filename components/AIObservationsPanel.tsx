/**
 * AIObservationsPanel Component
 *
 * Displays AI-generated observations and insights from the extraction process.
 * Shows critical alerts, warnings, and informational notes with severity filtering.
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ExternalLink,
  FileText,
} from 'lucide-react';
import {
  AIObservation,
  ObservationSeverity,
  ObservationCategory,
  DocumentReference,
} from '@/lib/extraction/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AIObservationsPanelProps {
  /** List of AI observations */
  observations: AIObservation[];
  /** Called when user acknowledges an observation */
  onAcknowledge?: (observationId: string) => void;
  /** Called when user responds to an observation */
  onRespond?: (observationId: string, response: string) => void;
  /** Called when user dismisses an observation */
  onDismiss?: (observationId: string) => void;
  /** Called when user clicks a document reference */
  onReferenceClick?: (reference: DocumentReference) => void;
  /** Whether the panel is collapsed */
  collapsed?: boolean;
  /** Called when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_CONFIG: Record<
  ObservationSeverity,
  {
    icon: typeof AlertTriangle;
    bgColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertTriangle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    iconColor: 'text-red-600',
    label: 'Critical',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-900',
    iconColor: 'text-amber-600',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600',
    label: 'Info',
  },
};

const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  scope_conflict: 'Scope Conflict',
  specification_mismatch: 'Spec Mismatch',
  quantity_concern: 'Quantity Concern',
  coordination_required: 'Coordination Required',
  addendum_impact: 'Addendum Impact',
  warranty_requirement: 'Warranty',
  code_compliance: 'Code Compliance',
  risk_flag: 'Risk',
  cost_impact: 'Cost Impact',
  schedule_impact: 'Schedule Impact',
  missing_information: 'Missing Info',
  substitution_available: 'Substitution',
};

// ============================================================================
// OBSERVATION CARD COMPONENT
// ============================================================================

interface ObservationCardProps {
  observation: AIObservation;
  onAcknowledge?: (id: string) => void;
  onRespond?: (id: string, response: string) => void;
  onDismiss?: (id: string) => void;
  onReferenceClick?: (ref: DocumentReference) => void;
}

function ObservationCard({
  observation,
  onAcknowledge,
  onRespond,
  onDismiss,
  onReferenceClick,
}: ObservationCardProps) {
  const [expanded, setExpanded] = useState(observation.severity === 'critical');
  const [responseText, setResponseText] = useState('');
  const [showResponseInput, setShowResponseInput] = useState(false);

  const config = SEVERITY_CONFIG[observation.severity];
  const Icon = config.icon;

  const handleSubmitResponse = () => {
    if (responseText.trim() && onRespond) {
      onRespond(observation.id, responseText.trim());
      setResponseText('');
      setShowResponseInput(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-black/5 transition-colors`}
      >
        <Icon className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase ${config.iconColor}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500">
              {CATEGORY_LABELS[observation.category] || observation.category}
            </span>
          </div>
          <h4 className={`font-medium ${config.textColor}`}>{observation.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {observation.userAcknowledged && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
              Acknowledged
            </span>
          )}
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
            <div className="px-4 pb-4 pt-0 space-y-3">
              {/* Insight */}
              <p className="text-sm text-gray-700 leading-relaxed pl-8">
                {observation.insight}
              </p>

              {/* Affected packages */}
              {observation.affectedWorkPackages.length > 0 && (
                <div className="pl-8">
                  <p className="text-xs text-gray-500 mb-1">Affected Packages:</p>
                  <div className="flex flex-wrap gap-1">
                    {observation.affectedWorkPackages.map((pkgId) => (
                      <span
                        key={pkgId}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded"
                      >
                        {pkgId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Document references */}
              {observation.references.length > 0 && (
                <div className="pl-8">
                  <p className="text-xs text-gray-500 mb-1">References:</p>
                  <div className="flex flex-wrap gap-2">
                    {observation.references.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => onReferenceClick?.(ref)}
                        className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        {ref.displayLabel}
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested actions */}
              {observation.suggestedActions && observation.suggestedActions.length > 0 && (
                <div className="pl-8">
                  <p className="text-xs text-gray-500 mb-1">Suggested Actions:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {observation.suggestedActions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* User response */}
              {observation.userResponse && (
                <div className="pl-8 bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-green-600 font-medium mb-1">Your response:</p>
                  <p className="text-sm text-gray-700">{observation.userResponse}</p>
                </div>
              )}

              {/* Response input */}
              {showResponseInput && (
                <div className="pl-8 space-y-2">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Add a note or response..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowResponseInput(false)}
                      className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitResponse}
                      disabled={!responseText.trim()}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!observation.userAcknowledged && !showResponseInput && (
                <div className="pl-8 flex items-center gap-2">
                  <button
                    onClick={() => onAcknowledge?.(observation.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Acknowledge
                  </button>
                  <button
                    onClick={() => setShowResponseInput(true)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Add Note
                  </button>
                  <button
                    onClick={() => onDismiss?.(observation.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AIObservationsPanel({
  observations,
  onAcknowledge,
  onRespond,
  onDismiss,
  onReferenceClick,
  collapsed = false,
  onCollapseChange,
  className = '',
}: AIObservationsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<ObservationSeverity | 'all'>('all');

  // Group observations by severity
  const groupedObservations = useMemo(() => {
    const groups: Record<ObservationSeverity, AIObservation[]> = {
      critical: [],
      warning: [],
      info: [],
    };

    for (const obs of observations) {
      groups[obs.severity].push(obs);
    }

    return groups;
  }, [observations]);

  // Filter observations
  const filteredObservations = useMemo(() => {
    if (severityFilter === 'all') return observations;
    return observations.filter((o) => o.severity === severityFilter);
  }, [observations, severityFilter]);

  // Count stats
  const stats = useMemo(
    () => ({
      total: observations.length,
      critical: groupedObservations.critical.length,
      warning: groupedObservations.warning.length,
      info: groupedObservations.info.length,
      unacknowledged: observations.filter((o) => !o.userAcknowledged).length,
    }),
    [observations, groupedObservations]
  );

  if (observations.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Check className="h-8 w-8 text-green-500" />
          <div>
            <p className="font-medium text-gray-700">No Issues Found</p>
            <p className="text-sm">The AI analysis did not identify any concerns.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onCollapseChange?.(!collapsed)}
              className="flex items-center gap-2"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
              <h3 className="font-semibold text-gray-900">AI Observations</h3>
            </button>

            {/* Stats badges */}
            <div className="flex items-center gap-2">
              {stats.critical > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {stats.critical} Critical
                </span>
              )}
              {stats.warning > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {stats.warning} Warnings
                </span>
              )}
              {stats.info > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  {stats.info} Info
                </span>
              )}
            </div>
          </div>

          {/* Filter */}
          {!collapsed && (
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as ObservationSeverity | 'all')
              }
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
            >
              <option value="all">All ({stats.total})</option>
              <option value="critical">Critical ({stats.critical})</option>
              <option value="warning">Warnings ({stats.warning})</option>
              <option value="info">Info ({stats.info})</option>
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {filteredObservations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No observations match the selected filter.
                </p>
              ) : (
                filteredObservations.map((observation) => (
                  <ObservationCard
                    key={observation.id}
                    observation={observation}
                    onAcknowledge={onAcknowledge}
                    onRespond={onRespond}
                    onDismiss={onDismiss}
                    onReferenceClick={onReferenceClick}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
