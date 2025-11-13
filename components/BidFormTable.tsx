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

  const handleAddRow = () => {
    const newItem: LineItem = {
      id: `temp-${Date.now()}`,
      item_number: '',
      description: '',
      quantity: null,
      unit: '',
      unit_price: null,
      total_price: null,
      notes: '',
      verified: false,
    };
    const updated = [...lineItems, newItem];
    setLineItems(updated);
    onUpdate(updated);
  };

  const handleDeleteRow = (index: number) => {
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
    onUpdate(updated);
  };

  const handleChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate total price
    if (field === 'quantity' || field === 'unit_price') {
      const qty = field === 'quantity' ? parseFloat(value) || 0 : updated[index].quantity || 0;
      const price = field === 'unit_price' ? parseFloat(value) || 0 : updated[index].unit_price || 0;
      updated[index].total_price = qty * price;
    }

    setLineItems(updated);
    onUpdate(updated);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Bid Form Line Items</h2>
        {!readOnly && (
          <button
            onClick={handleAddRow}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
          >
            + Add Line Item
          </button>
        )}
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
              <th className="px-3 py-3 text-left font-semibold text-white w-28">Unit Price</th>
              <th className="px-3 py-3 text-left font-semibold text-white w-28">Total</th>
              <th className="px-3 py-3 text-left font-semibold text-white min-w-32">Notes</th>
              {!readOnly && <th className="px-3 py-3 text-left font-semibold text-white w-20">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-600 font-medium">
                  No line items. {!readOnly && 'Click "Add Line Item" to get started.'}
                </td>
              </tr>
            ) : (
              lineItems.map((item, index) => {
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
                      type="number"
                      value={item.unit_price || ''}
                      onChange={(e) => handleChange(index, 'unit_price', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-700 disabled:border-gray-400 text-gray-900"
                      placeholder="$0.00"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-gray-900 text-base">
                    ${(item.total_price || 0).toFixed(2)}
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
              })
            )}
          </tbody>
          <tfoot className="bg-gradient-to-r from-blue-600 to-blue-700 border-t-2 border-blue-800">
            <tr>
              <td colSpan={6} className="px-3 py-4 text-right text-white font-semibold text-base">Total Amount:</td>
              <td className="px-3 py-4 text-white font-bold text-xl">${totalAmount.toFixed(2)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
