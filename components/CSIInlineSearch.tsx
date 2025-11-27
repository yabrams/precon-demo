'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { searchCSICodes, getCodesByLevel } from '@/lib/csi/csiClient';

interface CSIInlineSearchProps {
  initialValue: string;
  onSelect: (code: string, title: string) => void;
  onBlur: () => void;
  placeholder?: string;
  dropdownDirection?: 'up' | 'down';
  onFieldKeyDown?: (e: React.KeyboardEvent) => void;
  levelFilter?: (1 | 2 | 3 | 4)[];
  showAllOnFocus?: boolean;
}

interface SearchResult {
  code: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  division: string;
  score: number;
}

export default function CSIInlineSearch({
  initialValue,
  onSelect,
  onBlur,
  placeholder = 'Search CSI code...',
  dropdownDirection = 'down',
  onFieldKeyDown,
  levelFilter,
  showAllOnFocus = false,
}: CSIInlineSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, bottom: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLSpanElement>(null);

  // Focus input on mount and show results if showAllOnFocus is enabled
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    if (showAllOnFocus) {
      setShowResults(true);
    }
  }, [showAllOnFocus]);

  // Update dropdown position when placeholder position changes
  useEffect(() => {
    const updatePosition = () => {
      if (placeholderRef.current) {
        const rect = placeholderRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          bottom: window.innerHeight - rect.bottom + window.scrollY,
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  // Client-side search
  const results = useMemo<SearchResult[]>(() => {
    // If showAllOnFocus is enabled and query is empty/short, show all codes for the level filter
    if (showAllOnFocus && query.length < 2 && levelFilter && levelFilter.length > 0) {
      const allCodes: SearchResult[] = [];
      for (const level of levelFilter) {
        const codes = getCodesByLevel(level);
        codes.forEach((code) => {
          allCodes.push({
            code: code.code,
            title: code.title,
            level: code.level,
            division: code.division,
            score: 100,
          });
        });
      }
      return allCodes;
    }

    if (query.length < 2) {
      return [];
    }

    const searchResults = searchCSICodes({
      query,
      limit: 10,
      caseSensitive: false,
      exactMatch: false,
      fuzzySearch: true,
      levels: levelFilter,
    });

    return searchResults.map((result) => ({
      code: result.code.code,
      title: result.code.title,
      level: result.code.level,
      division: result.code.division,
      score: result.score,
    }));
  }, [query, levelFilter, showAllOnFocus]);

  // Show results when query changes or when showAllOnFocus is enabled
  useEffect(() => {
    if (showAllOnFocus && results.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(query.length >= 2 && results.length > 0);
    }
    setSelectedIndex(0);
  }, [query, results.length, showAllOnFocus]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Escape - close dropdown
    if (e.key === 'Escape') {
      e.preventDefault();
      onBlur();
      return;
    }

    // Handle Tab for field navigation (delegate to parent)
    if (e.key === 'Tab') {
      if (onFieldKeyDown) {
        onFieldKeyDown(e);
      }
      return;
    }

    if (!showResults) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result.code, result.title);
    setShowResults(false);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onBlur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onBlur]);

  const renderDropdown = () => {
    if (typeof window === 'undefined') return null;

    const dropdownContent = (
      <div
        ref={dropdownRef}
        className="fixed bg-white border-2 border-zinc-400 rounded-lg shadow-2xl max-h-80"
        style={{
          ...(dropdownDirection === 'up'
            ? { bottom: `${dropdownPosition.bottom}px` }
            : { top: `${dropdownPosition.top}px` }),
          left: `${dropdownPosition.left}px`,
          width: `${Math.max(dropdownPosition.width, 480)}px`,
          zIndex: 9999,
        }}
      >
        <div className="px-3 py-2 border-b border-gray-100">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm border border-zinc-400 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white text-zinc-900 placeholder:text-zinc-400 shadow-lg"
            autoComplete="off"
          />
        </div>
        <div className="overflow-y-auto max-h-60">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.code}
                ref={(el) => {
                  if (el && index === selectedIndex) {
                    el.scrollIntoView({ block: 'nearest' });
                  }
                }}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
                  index === selectedIndex
                    ? 'bg-zinc-50 border-l-4 border-l-zinc-900'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded flex-shrink-0">
                    L{result.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900">
                      <span className="font-mono font-semibold">{result.code}</span>
                      <span className="text-zinc-600 ml-2">{result.title}</span>
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : query.length >= 2 ? (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              No results found. Try different keywords.
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              Type at least 2 characters to search...
            </div>
          )}
        </div>
      </div>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <>
      <span ref={placeholderRef} className="block w-full h-0" />
      {renderDropdown()}
    </>
  );
}
