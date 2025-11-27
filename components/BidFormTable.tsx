'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CSIInlineSearch from './CSIInlineSearch';

// Summary of other bid packages for reallocation
interface BidPackageSummary {
  id: string;
  name: string;
}

// Color palette for highlighting - must match DiagramOverlay
// Architectural Monochrome: Zinc-scale variations
const HIGHLIGHT_COLORS = [
  '#d4d4d8', // zinc-300
  '#a1a1aa', // zinc-400
  '#71717a', // zinc-500
  '#52525b', // zinc-600
  '#d4d4d8', // zinc-300 (repeat for more items)
  '#a1a1aa', // zinc-400
  '#71717a', // zinc-500
  '#52525b', // zinc-600
  '#d4d4d8', // zinc-300
  '#a1a1aa', // zinc-400
];

const getColorForItem = (index: number): string => {
  return HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
};

// Get confidence color class based on value (0-100)
// 0% = red, 100% = green
const getConfidenceColorClass = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined) {
    return 'text-gray-400'; // Default for items without confidence
  }

  // Clamp confidence to 0-100
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
    return 'bg-gray-200'; // Default for items without confidence
  }

  // Clamp confidence to 0-100
  const clamped = Math.max(0, Math.min(100, confidence));

  if (clamped >= 80) return 'bg-green-500';
  if (clamped >= 60) return 'bg-lime-500';
  if (clamped >= 40) return 'bg-yellow-500';
  if (clamped >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

// Get confidence text label based on value (0-100)
const getConfidenceLabel = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined) {
    return 'Low';
  }
  const clamped = Math.max(0, Math.min(100, confidence));
  if (clamped >= 80) return 'Very High';
  if (clamped >= 60) return 'High';
  if (clamped >= 40) return 'Medium';
  return 'Low';
};

// Get confidence badge background and border class based on value
const getConfidenceBadgeClass = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined) {
    return 'bg-gray-100 border-gray-300';
  }
  const clamped = Math.max(0, Math.min(100, confidence));
  if (clamped >= 80) return 'bg-emerald-200 border-emerald-400';
  if (clamped >= 60) return 'bg-lime-100 border-lime-300';
  if (clamped >= 40) return 'bg-yellow-100 border-yellow-300';
  return 'bg-red-100 border-red-300';
};

export interface LineItem {
  id?: string;
  item_number?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
  notes?: string | null;
  verified?: boolean;
  approved?: boolean; // New field for approval status
  confidence?: number | null; // 0-100 percentage
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  csiCode?: string | null; // CSI MasterFormat code (e.g., "03 30 00")
  csiTitle?: string | null; // CSI MasterFormat title (e.g., "Cast-in-Place Concrete")
}

interface BidFormTableProps {
  initialLineItems: LineItem[];
  onUpdate: (lineItems: LineItem[]) => void;
  readOnly?: boolean;
  hoveredItemId?: string | null;
  onHoverChange?: (itemId: string | null, element?: HTMLTableRowElement | null) => void;
  onChatOpen?: () => void;
  otherBidPackages?: BidPackageSummary[];
  onReallocateItem?: (itemId: string, targetPackageId: string) => void;
}

export default function BidFormTable({
  initialLineItems = [],
  onUpdate,
  readOnly = false,
  hoveredItemId,
  onHoverChange,
  onChatOpen,
  otherBidPackages = [],
  onReallocateItem
}: BidFormTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems || []);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'approved' | 'item_number' | 'description' | 'csiCode' | 'confidence' | null>('confidence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [reallocateDropdownIndex, setReallocateDropdownIndex] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [fadingOutItemId, setFadingOutItemId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [reallocateSearch, setReallocateSearch] = useState('');
  const [reallocateHighlightIndex, setReallocateHighlightIndex] = useState(0);
  const reallocateDropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // For SSR safety - only render portal after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Click outside handler for reallocate dropdown
  useEffect(() => {
    if (reallocateDropdownIndex === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is inside dropdown
      if (reallocateDropdownRef.current?.contains(target)) return;
      // Check if click is on any reallocate button
      for (const btn of buttonRefs.current.values()) {
        if (btn?.contains(target)) return;
      }
      setReallocateDropdownIndex(null);
      setDropdownPosition(null);
      setReallocateSearch('');
    };

    // Use setTimeout to avoid catching the click that opened the dropdown
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [reallocateDropdownIndex]);

  const handleReallocate = (itemId: string, targetPackageId: string) => {
    if (onReallocateItem) {
      // Start fade-out animation
      setFadingOutItemId(itemId);
      setReallocateDropdownIndex(null);
      setDropdownPosition(null);
      setReallocateSearch('');

      // Wait for animation to complete before actually reallocating
      setTimeout(() => {
        onReallocateItem(itemId, targetPackageId);
        setFadingOutItemId(null);
      }, 300);
    }
  };

  useEffect(() => {
    console.log('BidFormTable: initialLineItems changed, count:', initialLineItems.length);
    console.log('BidFormTable: First item:', initialLineItems[0]);

    // Migration: Assign random confidence values to items without one and set approved status
    const itemsWithDefaults = initialLineItems.map(item => ({
      ...item,
      confidence: item.confidence ?? Math.floor(Math.random() * 101), // 0-100
      approved: item.approved ?? false, // Default to not approved
    }));

    // Don't sort here - sorting is now controlled by user via column headers
    setLineItems(itemsWithDefaults);
  }, [initialLineItems]);

  const handleDeleteRow = (index: number) => {
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    onUpdate(updated);
  };

  const handleChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    setLineItems(updated);
    onUpdate(updated);
  };

  const handleApproveAll = () => {
    const updated = lineItems.map(item => ({ ...item, approved: true }));
    setLineItems(updated);
    onUpdate(updated);
  };

  const handleUnapproveAll = () => {
    const updated = lineItems.map(item => ({ ...item, approved: false }));
    setLineItems(updated);
    onUpdate(updated);
  };

  const handlePlaceholderChange = (field: keyof LineItem, value: any) => {
    // When user starts typing in the placeholder row, create a new item
    const newItem: LineItem = {
      id: `temp-${Date.now()}`,
      item_number: field === 'item_number' ? value : '',
      description: field === 'description' ? value : '',
      quantity: field === 'quantity' ? value : null,
      unit: field === 'unit' ? value : '',
      notes: field === 'notes' ? value : '',
      confidence: field === 'confidence' ? parseFloat(value) : 50, // Default to 50% confidence
      verified: false,
      approved: false, // Default to not approved
    };
    const updated = [...lineItems, newItem];

    // Don't sort here - sorting is controlled by user via column headers
    setLineItems(updated);
    onUpdate(updated);
  };

  const isEditing = (rowIndex: number, field: string) => {
    return editingCell?.rowIndex === rowIndex && editingCell?.field === field;
  };

  const startEditing = (rowIndex: number, field: string) => {
    if (!readOnly) {
      setEditingCell({ rowIndex, field });
    }
  };

  const stopEditing = () => {
    setEditingCell(null);
  };

  const handleCSISelect = (index: number, code: string, title: string) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      csiCode: code,
      csiTitle: title,
    };
    setLineItems(updated);
    onUpdate(updated);
    stopEditing();
  };

  // Handle column sort
  const handleSort = (column: 'approved' | 'item_number' | 'description' | 'csiCode' | 'confidence') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort function
  const sortItems = (items: LineItem[]): LineItem[] => {
    if (!sortColumn) return items;

    return [...items].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'approved':
          const aApproved = a.approved ? 1 : 0;
          const bApproved = b.approved ? 1 : 0;
          comparison = aApproved - bApproved;
          break;
        case 'item_number':
          comparison = (a.item_number || '').localeCompare(b.item_number || '', undefined, { numeric: true });
          break;
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        case 'csiCode':
          comparison = (a.csiCode || '').localeCompare(b.csiCode || '', undefined, { numeric: true });
          break;
        case 'confidence':
          comparison = (a.confidence ?? 0) - (b.confidence ?? 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Filter items based on search query
  const filteredItems = (() => {
    const query = searchQuery.trim().toLowerCase();
    let result: LineItem[];

    if (!query) {
      result = lineItems;
    } else {
      // First, check for exact item_number match
      const exactItemMatch = lineItems.filter(item =>
        (item.item_number || '').toLowerCase() === query
      );
      if (exactItemMatch.length > 0) {
        result = exactItemMatch;
      } else {
        // Then check for items where item_number starts with the query
        const startsWithMatch = lineItems.filter(item =>
          (item.item_number || '').toLowerCase().startsWith(query)
        );
        if (startsWithMatch.length > 0) {
          result = startsWithMatch;
        } else {
          // Finally, fall back to substring search across all fields
          result = lineItems.filter(item => {
            const searchableFields = [
              item.item_number || '',
              item.description || '',
              item.notes || '',
              item.csiCode || '',
              item.csiTitle || '',
            ];

            return searchableFields.some(field =>
              field.toLowerCase().includes(query)
            );
          });
        }
      }
    }

    // Apply sorting
    return sortItems(result);
  })();

  // Sort indicator component
  const SortIndicator = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-300 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-zinc-700 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-zinc-700 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-64 pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {searchQuery && (
              <span className="absolute -right-16 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                {filteredItems.length}/{lineItems.length}
              </span>
            )}
          </div>
          {!readOnly && lineItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApproveAll}
                className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                title="Approve all items"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Approve All
              </button>
              <button
                onClick={handleUnapproveAll}
                className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                title="Unapprove all items"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Unapprove All
              </button>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-5 bg-gray-50">
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('approved')}
              >
                <div className="flex items-center justify-center">
                  Approved
                  <SortIndicator column="approved" />
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('item_number')}
              >
                <div className="flex items-center">
                  Item #
                  <SortIndicator column="item_number" />
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-64 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('description')}
              >
                <div className="flex items-center">
                  Description
                  <SortIndicator column="description" />
                </div>
              </th>
              <th
                className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-80 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                onClick={() => handleSort('csiCode')}
              >
                <div className="flex items-center">
                  CSI MasterFormat
                  <SortIndicator column="csiCode" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-32">Notes</th>
              {!readOnly && <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredItems.map((item, filteredIndex) => {
                // Find the original index in lineItems for editing/deleting
                const index = lineItems.findIndex(li => li.id === item.id);
                const isHovered = hoveredItemId === item.id;
                const highlightColor = getColorForItem(filteredIndex);
                const hasBoundingBox = !!item.boundingBox;

                return (
                  <tr
                    key={item.id || index}
                    className={`transition-all duration-300 hover:bg-gray-50 ${
                      fadingOutItemId === item.id
                        ? 'opacity-0 scale-95 bg-amber-50'
                        : 'opacity-100 scale-100'
                    }`}
                    style={{
                      backgroundColor: fadingOutItemId === item.id
                        ? undefined
                        : (isHovered && hasBoundingBox ? `${highlightColor}40` : undefined),
                      borderLeft: isHovered && hasBoundingBox ? `4px solid ${highlightColor}` : undefined,
                    }}
                    onMouseEnter={(e) => hasBoundingBox && onHoverChange?.(item.id || null, e.currentTarget)}
                    onMouseLeave={() => hasBoundingBox && onHoverChange?.(null, null)}
                  >
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleChange(index, 'approved', !item.approved)}
                      disabled={readOnly}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                        item.approved
                          ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 hover:bg-emerald-200'
                          : 'bg-zinc-100 text-zinc-400 border border-zinc-200 hover:bg-zinc-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={item.approved ? 'Approved - click to unapprove' : 'Click to approve'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    {isEditing(index, 'item_number') && !readOnly ? (
                      <input
                        type="text"
                        value={item.item_number || ''}
                        onChange={(e) => handleChange(index, 'item_number', e.target.value)}
                        onBlur={stopEditing}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 font-mono placeholder:text-gray-400"
                        placeholder="#"
                      />
                    ) : (
                      <div
                        onClick={() => !readOnly && startEditing(index, 'item_number')}
                        className={`w-full px-3 py-2 text-sm text-zinc-900 font-mono rounded-lg min-h-[2.5rem] flex items-center ${
                          readOnly ? '' : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        {item.item_number || <span className="text-gray-400">#</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing(index, 'description') && !readOnly ? (
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => handleChange(index, 'description', e.target.value)}
                        onBlur={stopEditing}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-gray-400"
                        placeholder="Description"
                      />
                    ) : (
                      <div
                        onClick={() => !readOnly && startEditing(index, 'description')}
                        className={`w-full px-3 py-2 text-sm text-zinc-900 rounded-lg min-h-[2.5rem] flex items-center ${
                          readOnly ? '' : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        {item.description || <span className="text-gray-400">Description</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing(index, 'csiCode') && !readOnly ? (
                      <CSIInlineSearch
                        initialValue={item.csiCode || item.csiTitle || ''}
                        onSelect={(code, title) => handleCSISelect(index, code, title)}
                        onBlur={stopEditing}
                        placeholder="Search CSI code or description..."
                        currentCode={item.csiCode}
                        confidenceLabel={getConfidenceLabel(item.confidence)}
                        confidenceBadgeClass={getConfidenceBadgeClass(item.confidence)}
                      />
                    ) : (
                      <div
                        onClick={() => !readOnly && startEditing(index, 'csiCode')}
                        className={`w-full px-3 py-2 text-sm rounded-lg min-h-[2.5rem] flex items-center justify-between ${
                          readOnly ? '' : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex-1">
                          {item.csiCode && item.csiTitle ? (
                            item.csiCode === 'N/A' && item.csiTitle === 'N/A' ? (
                              <span className="text-gray-400 italic">N/A</span>
                            ) : (
                              <span className="text-zinc-900">
                                <span className="font-mono font-semibold">{item.csiCode}</span>
                                <span className="text-zinc-600 ml-2">{item.csiTitle}</span>
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </span>
                        {/* Confidence indicator */}
                        <span className={`ml-3 px-2 py-0.5 border text-[10px] font-medium rounded flex items-center gap-1 text-gray-700 ${getConfidenceBadgeClass(item.confidence)}`}>
                          <span className="grayscale brightness-0">✨</span>
                          <span>{getConfidenceLabel(item.confidence)}</span>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing(index, 'notes') && !readOnly ? (
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleChange(index, 'notes', e.target.value)}
                        onBlur={stopEditing}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-gray-400"
                        placeholder="Notes"
                      />
                    ) : (
                      <div
                        onClick={() => !readOnly && startEditing(index, 'notes')}
                        className={`w-full px-3 py-2 text-sm text-zinc-900 rounded-lg min-h-[2.5rem] flex items-center ${
                          readOnly ? '' : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        {item.notes || <span className="text-gray-400">Notes</span>}
                      </div>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {/* Reallocate Button with Dropdown */}
                        {otherBidPackages.length > 0 && onReallocateItem && item.id && (
                          <>
                            <button
                              ref={(el) => {
                                if (el) buttonRefs.current.set(index, el);
                                else buttonRefs.current.delete(index);
                              }}
                              onClick={(e) => {
                                if (reallocateDropdownIndex === index) {
                                  setReallocateDropdownIndex(null);
                                  setDropdownPosition(null);
                                  setReallocateSearch('');
                                  setReallocateHighlightIndex(0);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownPosition({
                                    top: rect.bottom + 4,
                                    left: Math.max(8, rect.right - 250), // Align right edge with button, min 8px from left
                                  });
                                  setReallocateDropdownIndex(index);
                                  setReallocateHighlightIndex(0);
                                }
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 hover:border-zinc-300 rounded-full transition-all"
                              title="Move to another bid package"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </button>
                            {mounted && reallocateDropdownIndex === index && dropdownPosition && (() => {
                              const filteredPackages = otherBidPackages.filter(pkg =>
                                pkg.name.toLowerCase().includes(reallocateSearch.toLowerCase())
                              );
                              return createPortal(
                                <div
                                  ref={reallocateDropdownRef}
                                  className="fixed bg-white border-2 border-zinc-400 rounded-lg shadow-2xl min-w-[280px] max-h-80"
                                  style={{
                                    top: dropdownPosition.top,
                                    left: dropdownPosition.left,
                                    zIndex: 9999,
                                  }}
                                >
                                  <div className="px-3 py-2 border-b border-gray-100">
                                    <input
                                      type="text"
                                      value={reallocateSearch}
                                      onChange={(e) => {
                                        setReallocateSearch(e.target.value);
                                        setReallocateHighlightIndex(0);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setReallocateDropdownIndex(null);
                                          setDropdownPosition(null);
                                          setReallocateSearch('');
                                          setReallocateHighlightIndex(0);
                                        } else if (e.key === 'ArrowDown') {
                                          e.preventDefault();
                                          setReallocateHighlightIndex(prev =>
                                            Math.min(prev + 1, filteredPackages.length - 1)
                                          );
                                        } else if (e.key === 'ArrowUp') {
                                          e.preventDefault();
                                          setReallocateHighlightIndex(prev => Math.max(prev - 1, 0));
                                        } else if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (filteredPackages.length > 0 && filteredPackages[reallocateHighlightIndex]) {
                                            handleReallocate(item.id!, filteredPackages[reallocateHighlightIndex].id);
                                          }
                                        }
                                      }}
                                      placeholder="Search divisions..."
                                      className="w-full px-3 py-2 text-sm border border-zinc-400 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-400 shadow-lg"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="overflow-y-auto max-h-60">
                                    {filteredPackages.map((pkg, pkgIndex) => (
                                      <button
                                        key={pkg.id}
                                        ref={(el) => {
                                          if (el && pkgIndex === reallocateHighlightIndex) {
                                            el.scrollIntoView({ block: 'nearest' });
                                          }
                                        }}
                                        onClick={() => handleReallocate(item.id!, pkg.id)}
                                        onMouseEnter={() => setReallocateHighlightIndex(pkgIndex)}
                                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                                          pkgIndex === reallocateHighlightIndex
                                            ? 'bg-zinc-50 border-l-4 border-l-zinc-900'
                                            : 'hover:bg-gray-50'
                                        }`}
                                      >
                                        {pkg.name}
                                      </button>
                                    ))}
                                    {filteredPackages.length === 0 && (
                                      <div className="px-3 py-3 text-xs text-gray-500 text-center">
                                        No matching divisions found.
                                      </div>
                                    )}
                                  </div>
                                </div>,
                                document.body
                              );
                            })()}
                          </>
                        )}
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteRow(index)}
                          className="inline-flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-red-500 bg-zinc-100 hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-full transition-all"
                          title="Delete row"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}

            {/* Placeholder row for adding new items (always visible when not read-only) */}
            {!readOnly && (
              <tr className="opacity-60 hover:opacity-100 transition-opacity bg-gray-50/30">
                <td className="px-3 py-3 text-center">
                  {/* Empty cell for approved column in placeholder row */}
                  <span className="text-xs text-gray-400">-</span>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('item_number', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 font-mono placeholder:text-gray-400"
                    placeholder="#"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('description', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-gray-400"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-gray-400 italic">Auto-matched on extraction</span>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('notes', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-gray-400"
                    placeholder="Notes"
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-gray-500 italic">Start typing...</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
          </div>
        </div>
      </div>
    </div>
  );
}
