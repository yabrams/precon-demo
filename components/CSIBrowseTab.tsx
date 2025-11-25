'use client';

import { useState, useEffect, useMemo } from 'react';
import { getCategoryTree } from '@/lib/csi/csiClient';
import { CSICode } from '@/lib/csi/csiTypes';

interface CSIBrowseTabProps {
  onSelectCode: (code: string, title: string) => void;
}

interface CategoryNode {
  code: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  children?: CategoryNode[];
  isExpanded?: boolean;
}

export default function CSIBrowseTab({ onSelectCode }: CSIBrowseTabProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Load categories directly from client-side module
  const categories = useMemo<CategoryNode[]>(() => {
    const tree = getCategoryTree();
    return tree as CategoryNode[];
  }, []);

  const toggleExpand = (code: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allCodes = new Set<string>();
    const collectCodes = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          allCodes.add(node.code);
          collectCodes(node.children);
        }
      });
    };
    collectCodes(categories);
    setExpandedNodes(allCodes);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const renderNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.code);
    const indentClass = `ml-${depth * 4}`;

    const getLevelColor = (level: number) => {
      // Grayscale only as per user preference
      return 'bg-gray-100 text-gray-700 border-gray-300';
    };

    return (
      <div key={node.code}>
        <div
          className={`group ${depth > 0 ? 'border-l-2 border-gray-200' : ''}`}
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2 py-2 hover:bg-gray-50">
            {/* Expand/Collapse Button */}
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.code)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-zinc-900 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Node Content */}
            <button
              onClick={() => onSelectCode(node.code, node.title)}
              className="flex-1 flex items-center gap-2 text-left p-2 rounded hover:bg-gray-100 transition-colors group-hover:bg-gray-100"
            >
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded border font-mono ${getLevelColor(
                  node.level
                )}`}
              >
                L{node.level}
              </span>
              <span className="font-mono text-sm font-bold text-zinc-900">
                {node.code}
              </span>
              <span className="text-sm text-gray-700 flex-1">{node.title}</span>
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-zinc-900 font-mono">{categories.length}</span> divisions
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 hover:text-zinc-900 font-medium transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 text-gray-700 rounded hover:bg-gray-200 hover:text-zinc-900 font-medium transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-zinc-900 mb-2">Level Legend:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded font-medium font-mono">
            L1 - Division
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded font-medium font-mono">
            L2 - Section
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded font-medium font-mono">
            L3 - Subsection
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded font-medium font-mono">
            L4 - Detail
          </span>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="max-h-[calc(100vh-450px)] overflow-y-auto">
          {categories.map((category) => renderNode(category, 0))}
        </div>
      </div>
    </div>
  );
}
