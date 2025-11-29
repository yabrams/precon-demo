/**
 * DocumentReferenceCard Component
 *
 * Displays a document reference with thumbnail preview, location info,
 * and click-to-navigate functionality.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ExternalLink,
  MapPin,
  Eye,
  X,
  ZoomIn,
  Maximize2,
} from 'lucide-react';
import {
  DocumentReference,
  DocumentType,
  DocumentRelationshipType,
} from '@/lib/extraction/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentReferenceCardProps {
  /** The document reference to display */
  reference: DocumentReference;
  /** Called when user clicks to navigate to the reference */
  onNavigate?: (reference: DocumentReference) => void;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show preview on hover */
  showPreviewOnHover?: boolean;
  /** Custom class name */
  className?: string;
}

export interface DocumentReferenceListProps {
  /** List of references */
  references: DocumentReference[];
  /** Called when user clicks to navigate */
  onNavigate?: (reference: DocumentReference) => void;
  /** Maximum items to show before "show more" */
  maxVisible?: number;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  design_drawings: 'DWG',
  specifications: 'SPEC',
  addendum: 'ADD',
  bid_form: 'BID',
  geotechnical: 'GEO',
  permits: 'PRMT',
  contracts: 'CONT',
  schedules: 'SCHED',
  details: 'DTL',
  other: 'DOC',
};

const RELATIONSHIP_LABELS: Record<DocumentRelationshipType, string> = {
  defined_at: 'Defined',
  modified_by: 'Modified by',
  clarified_in: 'Clarified',
  quantity_from: 'Quantity from',
  detail_at: 'Detail at',
  schedule_in: 'Schedule',
  spec_section: 'Spec section',
  superseded_by: 'Superseded by',
  conflicts_with: 'Conflicts',
};

const RELATIONSHIP_COLORS: Record<DocumentRelationshipType, string> = {
  defined_at: 'bg-blue-100 text-blue-700',
  modified_by: 'bg-amber-100 text-amber-700',
  clarified_in: 'bg-green-100 text-green-700',
  quantity_from: 'bg-purple-100 text-purple-700',
  detail_at: 'bg-cyan-100 text-cyan-700',
  schedule_in: 'bg-orange-100 text-orange-700',
  spec_section: 'bg-indigo-100 text-indigo-700',
  superseded_by: 'bg-red-100 text-red-700',
  conflicts_with: 'bg-red-200 text-red-800',
};

// ============================================================================
// THUMBNAIL PREVIEW COMPONENT
// ============================================================================

interface ThumbnailPreviewProps {
  reference: DocumentReference;
  onClose: () => void;
  onExpand?: () => void;
  /** Anchor element rect for positioning */
  anchorRect?: DOMRect | null;
}

function ThumbnailPreview({ reference, onClose, onExpand, anchorRect }: ThumbnailPreviewProps) {
  const { location } = reference;

  // Calculate position - show above by default, below if not enough space
  const getPosition = () => {
    if (!anchorRect) return { top: 0, left: 0 };

    const previewHeight = 300; // approximate height
    const previewWidth = 320;
    const padding = 8;

    // Prefer showing above the anchor
    let top = anchorRect.top - previewHeight - padding;
    let left = anchorRect.left + (anchorRect.width / 2) - (previewWidth / 2);

    // If not enough space above, show below
    if (top < padding) {
      top = anchorRect.bottom + padding;
    }

    // Keep within horizontal bounds
    left = Math.max(padding, Math.min(left, window.innerWidth - previewWidth - padding));

    return { top, left };
  };

  const position = getPosition();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-700 truncate">
          {location.sheetNumber || location.documentName}
        </span>
        <div className="flex items-center gap-1">
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Expand"
            >
              <Maximize2 className="h-3 w-3 text-gray-500" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="p-3">
        {location.thumbnailUrl ? (
          <div className="relative aspect-[4/3] bg-gray-100 rounded overflow-hidden">
            <img
              src={location.thumbnailUrl}
              alt={`Preview of ${location.documentName}`}
              className="w-full h-full object-contain"
            />
            {location.boundingBox && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10"
                style={{
                  left: `${location.boundingBox.x * 100}%`,
                  top: `${location.boundingBox.y * 100}%`,
                  width: `${location.boundingBox.width * 100}%`,
                  height: `${location.boundingBox.height * 100}%`,
                }}
              />
            )}
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gray-100 rounded flex items-center justify-center">
            <FileText className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Text excerpt */}
        {reference.previewSnippet && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 line-clamp-3">
            "{reference.previewSnippet}"
          </div>
        )}

        {/* Location details */}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          <span>Page {location.pageNumber}</span>
          {location.sheetNumber && (
            <>
              <span className="text-gray-300">|</span>
              <span>Sheet {location.sheetNumber}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DocumentReferenceCard({
  reference,
  onNavigate,
  compact = false,
  showPreviewOnHover = true,
  className = '',
}: DocumentReferenceCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { location, relationshipType, confidence, displayLabel } = reference;

  const handleMouseEnter = useCallback(() => {
    if (!showPreviewOnHover) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 500); // 500ms delay before showing preview
    setIsHovered(true);
  }, [showPreviewOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowPreview(false);
    setIsHovered(false);
  }, []);

  const handleClick = useCallback(() => {
    onNavigate?.(reference);
  }, [reference, onNavigate]);

  // Confidence color
  const confidenceColor =
    confidence >= 0.8
      ? 'text-green-600'
      : confidence >= 0.5
      ? 'text-amber-600'
      : 'text-red-600';

  // Compact version (inline pill)
  if (compact) {
    return (
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        <button
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
            border transition-colors
            ${
              isHovered
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
            }
          `}
          title={`${displayLabel} - ${RELATIONSHIP_LABELS[relationshipType]}`}
        >
          <span className="font-mono text-[10px] bg-gray-200 px-1 rounded">
            {DOCUMENT_TYPE_ICONS[location.documentType]}
          </span>
          <span className="truncate max-w-[100px]">{displayLabel}</span>
          <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
        </button>

        {/* Preview popup */}
        <AnimatePresence>
          {showPreview && (
            <ThumbnailPreview
              reference={reference}
              onClose={() => setShowPreview(false)}
              onExpand={() => {
                setShowPreview(false);
                onNavigate?.(reference);
              }}
              anchorRect={containerRef.current?.getBoundingClientRect()}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full card version
  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
      >
        <div className="flex items-start gap-3">
          {/* Document type icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-gray-600">
              {DOCUMENT_TYPE_ICONS[location.documentType]}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Document name and sheet */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">{displayLabel}</span>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>Page {location.pageNumber}</span>
              {location.sheetNumber && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="font-mono">{location.sheetNumber}</span>
                </>
              )}
            </div>

            {/* Relationship and confidence */}
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${RELATIONSHIP_COLORS[relationshipType]}`}
              >
                {RELATIONSHIP_LABELS[relationshipType]}
              </span>
              <span className={`text-xs ${confidenceColor}`}>
                {Math.round(confidence * 100)}% confidence
              </span>
            </div>

            {/* Reasoning */}
            {reference.reasoning && (
              <p className="mt-2 text-xs text-gray-500 line-clamp-2">{reference.reasoning}</p>
            )}
          </div>

          {/* Thumbnail */}
          {location.thumbnailUrl && (
            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded overflow-hidden relative">
              <img
                src={location.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Preview popup */}
      <AnimatePresence>
        {showPreview && (
          <ThumbnailPreview
            reference={reference}
            onClose={() => setShowPreview(false)}
            onExpand={() => {
              setShowPreview(false);
              onNavigate?.(reference);
            }}
            anchorRect={containerRef.current?.getBoundingClientRect()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// REFERENCE LIST COMPONENT
// ============================================================================

export function DocumentReferenceList({
  references,
  onNavigate,
  maxVisible = 3,
  className = '',
}: DocumentReferenceListProps) {
  const [expanded, setExpanded] = useState(false);

  if (references.length === 0) {
    return null;
  }

  const visibleRefs = expanded ? references : references.slice(0, maxVisible);
  const hiddenCount = references.length - maxVisible;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Source References ({references.length})
        </span>
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleRefs.map((ref) => (
          <DocumentReferenceCard
            key={ref.id}
            reference={ref}
            onNavigate={onNavigate}
            compact
          />
        ))}
      </div>
    </div>
  );
}
