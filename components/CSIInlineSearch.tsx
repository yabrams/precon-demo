'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { searchCSICodes } from '@/lib/csi/csiClient';

interface CSIInlineSearchProps {
  initialValue: string;
  onSelect: (code: string, title: string) => void;
  onBlur: () => void;
  placeholder?: string;
  dropdownDirection?: 'up' | 'down';
  onFieldKeyDown?: (e: React.KeyboardEvent) => void;
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
}: CSIInlineSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, bottom: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Update dropdown position when input position changes
  useEffect(() => {
    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          bottom: window.innerHeight - rect.top + window.scrollY,
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
  }, [showResults]);

  // Client-side search
  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) {
      return [];
    }

    const searchResults = searchCSICodes({
      query,
      limit: 10,
      caseSensitive: false,
      exactMatch: false,
      fuzzySearch: true,
    });

    return searchResults.map((result) => ({
      code: result.code.code,
      title: result.code.title,
      level: result.code.level,
      division: result.code.division,
      score: result.score,
    }));
  }, [query]);

  // Show results when query changes
  useEffect(() => {
    setShowResults(query.length >= 2 && results.length > 0);
    setSelectedIndex(0);
  }, [query, results.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Tab and Escape for field navigation (delegate to parent)
    if (e.key === 'Tab' || e.key === 'Escape') {
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
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
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
      <>
        {showResults && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="fixed bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-80 overflow-y-auto"
            style={{
              ...(dropdownDirection === 'up'
                ? { bottom: `${dropdownPosition.bottom}px` }
                : { top: `${dropdownPosition.top}px` }),
              left: `${dropdownPosition.left}px`,
              width: `${Math.max(dropdownPosition.width, 300)}px`,
              zIndex: 9999,
            }}
          >
            {results.map((result, index) => (
              <button
                key={result.code}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
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
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div
            className="fixed bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-3"
            style={{
              ...(dropdownDirection === 'up'
                ? { bottom: `${dropdownPosition.bottom}px` }
                : { top: `${dropdownPosition.top}px` }),
              left: `${dropdownPosition.left}px`,
              width: `${Math.max(dropdownPosition.width, 300)}px`,
              zIndex: 9999,
            }}
          >
            <p className="text-xs text-gray-500 text-center">
              No results found. Try different keywords.
            </p>
          </div>
        )}
      </>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-zinc-900 placeholder:text-gray-400 shadow-lg"
        autoComplete="off"
      />
      {renderDropdown()}
    </>
  );
}
