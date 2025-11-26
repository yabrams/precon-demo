'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineItem } from './BidFormTable';
import CSIInlineSearch from './CSIInlineSearch';

// Field names for navigation (in order)
const EDITABLE_FIELDS = ['csiCode', 'item_number', 'description', 'notes'] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

// Get confidence color class based on value (0-100)
const getConfidenceColorClass = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined) {
    return 'text-gray-400';
  }
  const clamped = Math.max(0, Math.min(100, confidence));
  if (clamped >= 80) return 'text-green-600';
  if (clamped >= 60) return 'text-lime-600';
  if (clamped >= 40) return 'text-yellow-600';
  if (clamped >= 20) return 'text-orange-600';
  return 'text-red-600';
};

// Get confidence background color for progress bar
const getConfidenceBarColor = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined) {
    return 'bg-gray-200';
  }
  const clamped = Math.max(0, Math.min(100, confidence));
  if (clamped >= 80) return 'bg-green-500';
  if (clamped >= 60) return 'bg-lime-500';
  if (clamped >= 40) return 'bg-yellow-500';
  if (clamped >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

interface SingleItemPanelProps {
  item: LineItem;
  itemIndex: number;
  totalItems: number;
  onUpdate: (item: LineItem) => void;
  onApprove: () => void;
  onApproveAndNext: () => void;
  onPrevious: () => void;
  onNext: () => void;
  readOnly?: boolean;
}

export interface SingleItemPanelRef {
  enterFieldMode: () => void;
}

const SingleItemPanel = forwardRef<SingleItemPanelRef, SingleItemPanelProps>(function SingleItemPanel({
  item,
  itemIndex,
  totalItems,
  onUpdate,
  onApprove,
  onApproveAndNext,
  onPrevious,
  onNext,
  readOnly = false,
}, ref) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldIndex, setFieldIndex] = useState(0);

  // Refs for each editable field
  const fieldRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Enter field mode - focus on first field
  const enterFieldMode = useCallback(() => {
    if (readOnly) return;
    const firstField = EDITABLE_FIELDS[0];
    setFieldIndex(0);
    setEditingField(firstField);
  }, [readOnly]);

  // Expose enterFieldMode to parent
  useImperativeHandle(ref, () => ({
    enterFieldMode,
  }), [enterFieldMode]);

  // Focus the field input when editing changes
  useEffect(() => {
    if (editingField && fieldRefs.current[editingField]) {
      fieldRefs.current[editingField]?.focus();
      fieldRefs.current[editingField]?.select();
    }
  }, [editingField]);

  // Handle field-level keyboard navigation
  const handleFieldKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Exit field mode - blur and go back to item navigation
      e.preventDefault();
      e.stopPropagation();
      setEditingField(null);
    } else if (e.key === 'ArrowUp') {
      // Exit field mode - blur and go back to item navigation
      e.preventDefault();
      setEditingField(null);
    } else if (e.key === 'ArrowLeft') {
      // Move to previous field
      e.preventDefault();
      const currentIndex = EDITABLE_FIELDS.indexOf(editingField as EditableField);
      if (currentIndex > 0) {
        const prevField = EDITABLE_FIELDS[currentIndex - 1];
        setFieldIndex(currentIndex - 1);
        setEditingField(prevField);
      }
    } else if (e.key === 'ArrowRight') {
      // Move to next field
      e.preventDefault();
      const currentIndex = EDITABLE_FIELDS.indexOf(editingField as EditableField);
      if (currentIndex < EDITABLE_FIELDS.length - 1) {
        const nextField = EDITABLE_FIELDS[currentIndex + 1];
        setFieldIndex(currentIndex + 1);
        setEditingField(nextField);
      }
    } else if (e.key === 'Tab') {
      // Tab also moves between fields (cyclic)
      e.preventDefault();
      const currentIndex = EDITABLE_FIELDS.indexOf(editingField as EditableField);
      if (e.shiftKey) {
        // Move to previous field (wrap to last if at first)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : EDITABLE_FIELDS.length - 1;
        const prevField = EDITABLE_FIELDS[prevIndex];
        setFieldIndex(prevIndex);
        setEditingField(prevField);
      } else {
        // Move to next field (wrap to first if at last)
        const nextIndex = currentIndex < EDITABLE_FIELDS.length - 1 ? currentIndex + 1 : 0;
        const nextField = EDITABLE_FIELDS[nextIndex];
        setFieldIndex(nextIndex);
        setEditingField(nextField);
      }
    }
  }, [editingField]);

  const handleChange = (field: keyof LineItem, value: any) => {
    onUpdate({ ...item, [field]: value });
  };

  const handleCSISelect = (code: string, title: string) => {
    onUpdate({ ...item, csiCode: code, csiTitle: title });
    setEditingField(null);
  };

  const isEditing = (field: string) => editingField === field;

  const startEditing = (field: string) => {
    if (!readOnly) {
      setEditingField(field);
    }
  };

  const stopEditing = () => {
    setEditingField(null);
  };

  const isFirstItem = itemIndex === 0;
  const isLastItem = itemIndex === totalItems - 1;

  return (
    <div className={`border-t flex-shrink-0 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] transition-colors duration-200 ${
      item.approved
        ? 'bg-gradient-to-b from-emerald-50 to-emerald-50/50 border-emerald-200'
        : 'bg-gradient-to-b from-zinc-50 to-white border-gray-200'
    }`} style={{ height: '150px' }}>
      {/* Navigation Bar */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between transition-colors duration-200 ${
        item.approved
          ? 'bg-gradient-to-r from-emerald-100 to-emerald-200 border-emerald-200'
          : 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onPrevious}
            disabled={isFirstItem}
            className={`p-1.5 rounded-lg transition-colors ${
              isFirstItem
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-300 hover:text-gray-900'
            }`}
            title="Previous item (←)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-zinc-900">
            {itemIndex + 1} / {totalItems}
          </span>
          <button
            onClick={onNext}
            disabled={isLastItem}
            className={`p-1.5 rounded-lg transition-colors ${
              isLastItem
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-300 hover:text-gray-900'
            }`}
            title="Next item (→)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Confidence - Center */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Confidence</span>
          <div className="flex items-center gap-2 w-32">
            <div className="flex-1 bg-gray-300 rounded-full h-2.5 border border-gray-400">
              <div
                className={`h-full rounded-full transition-all ${getConfidenceBarColor(item.confidence)}`}
                style={{ width: `${item.confidence ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-bold font-mono text-zinc-900">
              {item.confidence ?? 0}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unapprove Button - only shown for approved items */}
          {item.approved && !readOnly && (
            <button
              onClick={onApprove}
              className="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
              title="Unapprove (A)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Unapprove
            </button>
          )}

          {/* Approve Button - only shown for unapproved items */}
          {!item.approved && !readOnly && (
            <button
              onClick={onApprove}
              className="px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
              title="Approve (A)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </button>
          )}

          {/* Approve & Next Button - Primary Action (only shown for unapproved items) */}
          {!readOnly && !item.approved && (
            <button
              onClick={onApproveAndNext}
              className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              title="Approve and move to next (Enter)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve & Next
            </button>
          )}
        </div>
      </div>

      {/* Fields - Single Row with fade transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={itemIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
          className={`px-4 py-3.5 grid grid-cols-12 gap-3 transition-colors duration-200 ${
            item.approved ? 'bg-emerald-50/50' : 'bg-white'
          }`}
        >
          {/* CSI Code - First */}
          <div className="col-span-3">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              CSI MasterFormat
            </label>
            {isEditing('csiCode') && !readOnly ? (
              <CSIInlineSearch
                initialValue={item.csiCode || item.csiTitle || ''}
                onSelect={handleCSISelect}
                onBlur={stopEditing}
                placeholder="Search CSI code..."
                dropdownDirection="up"
                onFieldKeyDown={handleFieldKeyDown}
              />
            ) : (
              <div
                onClick={() => startEditing('csiCode')}
                className={`w-full px-3 py-2 text-sm rounded-lg min-h-[2.25rem] flex items-center transition-colors duration-200 ${
                  item.approved
                    ? `bg-emerald-100 border border-emerald-200 ${readOnly ? '' : 'cursor-pointer hover:bg-emerald-200 hover:border-emerald-300'}`
                    : `bg-zinc-100 border border-zinc-200 ${readOnly ? '' : 'cursor-pointer hover:bg-zinc-200 hover:border-zinc-300'}`
                }`}
              >
                {item.csiCode && item.csiTitle ? (
                  item.csiCode === 'N/A' && item.csiTitle === 'N/A' ? (
                    <span className="text-gray-400 italic">N/A</span>
                  ) : (
                    <span className="text-zinc-900">
                      <span className="font-mono font-semibold">{item.csiCode}</span>
                      <span className="text-zinc-600 ml-2 text-xs">{item.csiTitle}</span>
                    </span>
                  )
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            )}
          </div>

          {/* Item Number */}
          <div className="col-span-1">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Item #
            </label>
            {isEditing('item_number') && !readOnly ? (
              <input
                ref={(el) => { fieldRefs.current['item_number'] = el; }}
                type="text"
                value={item.item_number || ''}
                onChange={(e) => handleChange('item_number', e.target.value)}
                onBlur={stopEditing}
                onKeyDown={handleFieldKeyDown}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent bg-white text-zinc-900 font-mono"
                placeholder="#"
              />
            ) : (
              <div
                onClick={() => startEditing('item_number')}
                className={`w-full px-3 py-2 text-sm text-zinc-900 font-mono rounded-lg min-h-[2.25rem] flex items-center transition-colors duration-200 ${
                  item.approved
                    ? `bg-emerald-100 border border-emerald-200 ${readOnly ? '' : 'cursor-pointer hover:bg-emerald-200 hover:border-emerald-300'}`
                    : `bg-zinc-100 border border-zinc-200 ${readOnly ? '' : 'cursor-pointer hover:bg-zinc-200 hover:border-zinc-300'}`
                }`}
              >
                {item.item_number || <span className="text-gray-400">#</span>}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="col-span-4">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            {isEditing('description') && !readOnly ? (
              <input
                ref={(el) => { fieldRefs.current['description'] = el; }}
                type="text"
                value={item.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={stopEditing}
                onKeyDown={handleFieldKeyDown}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent bg-white text-zinc-900"
                placeholder="Description"
              />
            ) : (
              <div
                onClick={() => startEditing('description')}
                className={`w-full px-3 py-2 text-sm text-zinc-900 rounded-lg min-h-[2.25rem] flex items-center overflow-hidden transition-colors duration-200 ${
                  item.approved
                    ? `bg-emerald-100 border border-emerald-200 ${readOnly ? '' : 'cursor-pointer hover:bg-emerald-200 hover:border-emerald-300'}`
                    : `bg-zinc-100 border border-zinc-200 ${readOnly ? '' : 'cursor-pointer hover:bg-zinc-200 hover:border-zinc-300'}`
                }`}
              >
                <span className="truncate">{item.description || <span className="text-gray-400">Description</span>}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="col-span-4">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            {isEditing('notes') && !readOnly ? (
              <input
                ref={(el) => { fieldRefs.current['notes'] = el; }}
                type="text"
                value={item.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                onBlur={stopEditing}
                onKeyDown={handleFieldKeyDown}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent bg-white text-zinc-900"
                placeholder="Notes"
              />
            ) : (
              <div
                onClick={() => startEditing('notes')}
                className={`w-full px-3 py-2 text-sm text-zinc-900 rounded-lg min-h-[2.25rem] flex items-center overflow-hidden transition-colors duration-200 ${
                  item.approved
                    ? `bg-emerald-100 border border-emerald-200 ${readOnly ? '' : 'cursor-pointer hover:bg-emerald-200 hover:border-emerald-300'}`
                    : `bg-zinc-100 border border-zinc-200 ${readOnly ? '' : 'cursor-pointer hover:bg-zinc-200 hover:border-zinc-300'}`
                }`}
              >
                <span className="truncate">{item.notes || <span className="text-gray-400">Notes</span>}</span>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

    </div>
  );
});

export default SingleItemPanel;
