import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { LineItem } from '@/components/BidFormTable';

export function exportToPDF(lineItems: LineItem[], projectName?: string) {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(projectName || 'Bid Form', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  // Add table headers
  let y = 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const headers = ['Item #', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total'];
  const colWidths = [20, 70, 20, 20, 25, 25];
  let x = 14;

  headers.forEach((header, i) => {
    doc.text(header, x, y);
    x += colWidths[i];
  });

  // Add line items
  doc.setFont('helvetica', 'normal');
  y += 8;

  lineItems.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    x = 14;
    const row = [
      item.item_number || '-',
      item.description.substring(0, 35) || '-',
      item.quantity?.toString() || '-',
      item.unit || '-',
      item.unit_price ? `$${item.unit_price.toFixed(2)}` : '-',
      item.total_price ? `$${item.total_price.toFixed(2)}` : '-',
    ];

    row.forEach((cell, i) => {
      doc.text(cell, x, y);
      x += colWidths[i];
    });

    y += 7;
  });

  // Add total
  y += 5;
  doc.setFont('helvetica', 'bold');
  const total = lineItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
  doc.text(`Total: $${total.toFixed(2)}`, 160, y);

  // Save
  doc.save(`bid-form-${Date.now()}.pdf`);
}

export function exportToExcel(lineItems: LineItem[], projectName?: string) {
  const worksheetData = [
    ['Bid Form'],
    [projectName || 'Untitled Project'],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ['Item #', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Total Price', 'Notes'],
    ...lineItems.map((item) => [
      item.item_number || '',
      item.description || '',
      item.quantity || '',
      item.unit || '',
      item.unit_price || '',
      item.total_price || '',
      item.notes || '',
    ]),
    [],
    [
      'Total',
      '',
      '',
      '',
      '',
      lineItems.reduce((sum, item) => sum + (item.total_price || 0), 0),
      '',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bid Form');

  // Save
  XLSX.writeFile(workbook, `bid-form-${Date.now()}.xlsx`);
}

export function exportToCSV(lineItems: LineItem[]) {
  const headers = ['Item #', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Total Price', 'Notes'];

  const rows = lineItems.map((item) => [
    item.item_number || '',
    `"${item.description || ''}"`, // Quote description to handle commas
    item.quantity || '',
    item.unit || '',
    item.unit_price || '',
    item.total_price || '',
    `"${item.notes || ''}"`,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bid-form-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
