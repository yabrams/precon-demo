'use client';

/**
 * AmazonStyleDemo Component
 * Demonstrates the Amazon-inspired design patterns
 * Shows how to use OrderSummaryCard, SectionHeader, ProductCard, and IconButton together
 */

import React from 'react';
import OrderSummaryCard, { SummaryField } from './OrderSummaryCard';
import SectionHeader from './SectionHeader';
import ProductCard from './ProductCard';
import IconButton from './IconButton';

export default function AmazonStyleDemo() {
  // Example summary data
  const summaryFields: SummaryField[] = [
    {
      label: 'Project Created',
      value: 'November 21, 2025',
    },
    {
      label: 'Total Value',
      value: '$1,245,890',
    },
    {
      label: 'Assigned To',
      value: 'John Smith',
      isLink: true,
      onClick: () => console.log('User clicked'),
    },
  ];

  // Example bid packages
  const bidPackages = [
    {
      id: '1',
      title: 'Electrical Systems - Main Building Installation',
      subtitle: 'Review bid items for electrical work',
      metadata: [
        'Return or revise items: Eligible through January 31, 2026',
        'Status: In Progress',
      ],
    },
    {
      id: '2',
      title: 'HVAC Installation - Commercial Building Complex',
      subtitle: 'Complete HVAC bid form for all building zones',
      metadata: [
        'Return or revise items: Eligible through February 15, 2026',
        'Status: Draft',
      ],
    },
  ];

  const upcomingPackages = [
    {
      id: '3',
      title: 'Plumbing Rough-In - Multi-Story Office Building',
      subtitle: 'Bid package opens tomorrow at 9:00 AM',
      metadata: ['Bid Due: December 1, 2025', 'Estimated Value: $89,500'],
    },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[1000px] mx-auto space-y-6">
        {/* Summary Card */}
        <OrderSummaryCard fields={summaryFields} />

        {/* Active Section */}
        <div className="bg-white">
          <SectionHeader title="Active today" variant="teal" className="mb-5" />
          <div className="divide-y divide-gray-200">
            {bidPackages.map((pkg) => (
              <ProductCard
                key={pkg.id}
                title={pkg.title}
                subtitle={pkg.subtitle}
                metadata={pkg.metadata}
                onTitleClick={() => console.log(`Clicked: ${pkg.title}`)}
                actions={
                  <IconButton
                    icon="refresh"
                    label="Review again"
                    variant="outline"
                    size="md"
                    onClick={() => console.log(`Review: ${pkg.title}`)}
                  />
                }
              />
            ))}
          </div>
        </div>

        {/* Upcoming Section */}
        <div className="bg-white">
          <SectionHeader title="Opening tomorrow" variant="teal" className="mb-5" />
          <div className="divide-y divide-gray-200">
            {upcomingPackages.map((pkg) => (
              <ProductCard
                key={pkg.id}
                title={pkg.title}
                subtitle={pkg.subtitle}
                metadata={pkg.metadata}
                onTitleClick={() => console.log(`Clicked: ${pkg.title}`)}
                actions={
                  <div className="flex gap-2">
                    <IconButton
                      icon="add"
                      label="Add to watchlist"
                      variant="outline"
                      size="md"
                      onClick={() => console.log(`Add: ${pkg.title}`)}
                    />
                    <IconButton
                      icon="download"
                      label="Download specs"
                      variant="solid"
                      size="md"
                      onClick={() => console.log(`Download: ${pkg.title}`)}
                    />
                  </div>
                }
              />
            ))}
          </div>
        </div>

        {/* Additional Actions */}
        <div className="bg-white pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-[#0F1111] mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <IconButton
              icon="upload"
              label="Upload Diagram"
              variant="solid"
              size="md"
              onClick={() => console.log('Upload clicked')}
            />
            <IconButton
              icon="edit"
              label="Edit Project"
              variant="outline"
              size="md"
              onClick={() => console.log('Edit clicked')}
            />
            <IconButton
              icon="download"
              label="Export to PDF"
              variant="outline"
              size="md"
              onClick={() => console.log('Export clicked')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
