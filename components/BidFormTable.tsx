'use client';

import { useState, useEffect } from 'react';

// Color palette for highlighting - must match DiagramOverlay
const HIGHLIGHT_COLORS = [
  '#93c5fd', // blue-300
  '#fca5a5', // red-300
  '#86efac', // green-300
  '#fcd34d', // yellow-300
  '#c4b5fd', // violet-300
  '#fdba74', // orange-300
  '#f9a8d4', // pink-300
  '#67e8f9', // cyan-300
  '#d8b4fe', // purple-300
  '#a7f3d0', // emerald-300
];

const getColorForItem = (index: number): string => {
  return HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
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
}

export default function BidFormTable({
  initialLineItems,
  onUpdate,
  readOnly = false,
  hoveredItemId,
  onHoverChange
}: BidFormTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);

  useEffect(() => {
    console.log('BidFormTable: initialLineItems changed, count:', initialLineItems.length);
    console.log('BidFormTable: First item:', initialLineItems[0]);
    setLineItems(initialLineItems);
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
      verified: false,
    };
    const updated = [...lineItems, newItem];
    setLineItems(updated);
    onUpdate(updated);
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Bid Form</h2>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-white w-32">ID</th>
              <th className="px-3 py-3 text-left font-semibold text-white w-20">Item #</th>
              <th className="px-3 py-3 text-left font-semibold text-white min-w-64">Description</th>
              <th className="px-3 py-3 text-left font-semibold text-white w-24">Quantity</th>
              <th className="px-3 py-3 text-left font-semibold text-white w-20">Unit</th>
              <th className="px-3 py-3 text-left font-semibold text-white min-w-32">Notes</th>
              {!readOnly && <th className="px-3 py-3 text-left font-semibold text-white w-20">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {lineItems.map((item, index) => {
                const isHovered = hoveredItemId === item.id;
                const highlightColor = getColorForItem(index);
                const hasBoundingBox = !!item.boundingBox;

                return (
                  <tr
                    key={item.id || index}
                    className="transition-colors"
                    style={{
                      backgroundColor: isHovered && hasBoundingBox ? `${highlightColor}40` : undefined,
                      borderLeft: isHovered && hasBoundingBox ? `4px solid ${highlightColor}` : undefined,
                    }}
                    onMouseEnter={(e) => hasBoundingBox && onHoverChange?.(item.id || null, e.currentTarget)}
                    onMouseLeave={() => hasBoundingBox && onHoverChange?.(null, null)}
                  >
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-500 font-mono">{item.id || 'N/A'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.item_number || ''}
                      onChange={(e) => handleChange(index, 'item_number', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="#"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleChange(index, 'description', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="Description"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={(e) => handleChange(index, 'unit', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="EA"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleChange(index, 'notes', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="Notes"
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDeleteRow(index)}
                        className="px-2 py-1 text-red-700 font-medium hover:bg-red-100 rounded transition-colors text-xs border border-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}

            {/* Placeholder row for adding new items (always visible when not read-only) */}
            {!readOnly && (
              <tr className="opacity-50 hover:opacity-75 transition-opacity bg-gray-50">
                <td className="px-3 py-2">
                  <span className="text-xs text-gray-400 font-mono italic">New</span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('item_number', e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
                    placeholder="#"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('description', e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value=""
                    onChange={(e) => handlePlaceholderChange('quantity', e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
                    placeholder="0"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('unit', e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
                    placeholder="EA"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value=""
                    onChange={(e) => handlePlaceholderChange('notes', e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-gray-900"
                    placeholder="Notes"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-gray-400 italic">Start typing...</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
