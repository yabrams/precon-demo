'use client';

import { useState, useEffect } from 'react';

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
  confidence?: number | null; // 0-100 percentage
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

interface BidFormTableProps {
  initialLineItems: LineItem[];
  onUpdate: (lineItems: LineItem[]) => void;
  readOnly?: boolean;
  hoveredItemId?: string | null;
  onHoverChange?: (itemId: string | null, element?: HTMLTableRowElement | null) => void;
  onChatOpen?: () => void;
}

export default function BidFormTable({
  initialLineItems = [],
  onUpdate,
  readOnly = false,
  hoveredItemId,
  onHoverChange,
  onChatOpen
}: BidFormTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems || []);

  useEffect(() => {
    console.log('BidFormTable: initialLineItems changed, count:', initialLineItems.length);
    console.log('BidFormTable: First item:', initialLineItems[0]);

    // Migration: Assign random confidence values to items without one
    const itemsWithConfidence = initialLineItems.map(item => ({
      ...item,
      confidence: item.confidence ?? Math.floor(Math.random() * 101), // 0-100
    }));

    // Sort by confidence (ascending - lowest first)
    const sortedItems = [...itemsWithConfidence].sort((a, b) => {
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      return confA - confB;
    });

    setLineItems(sortedItems);
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
    };
    const updated = [...lineItems, newItem];

    // Sort by confidence (ascending - lowest first)
    updated.sort((a, b) => {
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      return confA - confB;
    });

    setLineItems(updated);
    onUpdate(updated);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">Bid Form</h2>
          {onChatOpen && (
            <button
              onClick={onChatOpen}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-zinc-900 hover:bg-gray-50 rounded-md transition-colors border border-gray-200"
              title="Open AI Chat Assistant"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Chat</span>
            </button>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-5 bg-gray-50">
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Item #</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-64">Description</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Quantity</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Unit</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-32">Notes</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Confidence</th>
              {!readOnly && <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {lineItems.map((item, index) => {
                const isHovered = hoveredItemId === item.id;
                const highlightColor = getColorForItem(index);
                const hasBoundingBox = !!item.boundingBox;

                return (
                  <tr
                    key={item.id || index}
                    className="transition-colors hover:bg-gray-50"
                    style={{
                      backgroundColor: isHovered && hasBoundingBox ? `${highlightColor}40` : undefined,
                      borderLeft: isHovered && hasBoundingBox ? `4px solid ${highlightColor}` : undefined,
                    }}
                    onMouseEnter={(e) => hasBoundingBox && onHoverChange?.(item.id || null, e.currentTarget)}
                    onMouseLeave={() => hasBoundingBox && onHoverChange?.(null, null)}
                  >
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={item.item_number || ''}
                      onChange={(e) => handleChange(index, 'item_number', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 font-mono placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="#"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleChange(index, 'description', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Description"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 font-mono placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="0"
                      step="1"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={item.unit || ''}
                      onChange={(e) => handleChange(index, 'unit', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select...</option>
                      <option value="EA">EA</option>
                      <option value="SF">SF</option>
                      <option value="LF">LF</option>
                      <option value="CY">CY</option>
                      <option value="SY">SY</option>
                      <option value="TON">TON</option>
                      <option value="LS">LS</option>
                      <option value="HR">HR</option>
                      <option value="DAY">DAY</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleChange(index, 'notes', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Notes"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-full bg-gray-200 rounded-full h-2 flex-1">
                        <div
                          className={`h-2 rounded-full transition-all ${getConfidenceBarColor(item.confidence)}`}
                          style={{ width: `${item.confidence ?? 0}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold font-mono ${getConfidenceColorClass(item.confidence)} min-w-[3rem] text-right`}>
                        {item.confidence ?? 0}%
                      </span>
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleDeleteRow(index)}
                        className="inline-flex items-center justify-center w-8 h-8 text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                        title="Delete row"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}

            {/* Placeholder row for adding new items (always visible when not read-only) */}
            {!readOnly && (
              <tr className="opacity-60 hover:opacity-100 transition-opacity bg-gray-50/30">
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('item_number', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 font-mono placeholder:text-gray-400"
                    placeholder="#"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('description', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 placeholder:text-gray-400"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    value=""
                    onChange={(e) => handlePlaceholderChange('quantity', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 font-mono placeholder:text-gray-400"
                    placeholder="0"
                    step="1"
                    min="0"
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    value=""
                    onChange={(e) => handlePlaceholderChange('unit', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900"
                  >
                    <option value="">Select...</option>
                    <option value="EA">EA</option>
                    <option value="SF">SF</option>
                    <option value="LF">LF</option>
                    <option value="CY">CY</option>
                    <option value="SY">SY</option>
                    <option value="TON">TON</option>
                    <option value="LS">LS</option>
                    <option value="HR">HR</option>
                    <option value="DAY">DAY</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('notes', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 placeholder:text-gray-400"
                    placeholder="Notes"
                  />
                </td>
                <td className="px-3 py-3">
                  {/* Confidence will be assigned on creation */}
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
