'use client';

import { useState, useEffect, useMemo } from 'react';
import { searchCSICodes } from '@/lib/csi/csiClient';
import { CSIMappingResponse } from '@/types/csi';

interface CSISearchTabProps {
  onSelectCode: (code: string, title: string) => void;
}

interface SearchResult {
  code: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  division: string;
  breadcrumb: string[];
  score: number;
}

interface AIMatch {
  code: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  confidence: number;
  reasoning: string;
  breadcrumb: string[];
}

export default function CSISearchTab({ onSelectCode }: CSISearchTabProps) {
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('');
  const [fuzzySearch, setFuzzySearch] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isAIMatching, setIsAIMatching] = useState(false);
  const [aiMatches, setAIMatches] = useState<AIMatch[]>([]);
  const [aiError, setAIError] = useState<string | null>(null);

  // Client-side search with debouncing
  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) {
      return [];
    }

    setIsSearching(true);

    try {
      const searchResults = searchCSICodes({
        query,
        divisions: division ? [division] : [],
        limit: 50,
        caseSensitive: false,
        exactMatch: false,
        fuzzySearch,
      });

      return searchResults.map((result) => ({
        code: result.code.code,
        title: result.code.title,
        level: result.code.level,
        division: result.code.division,
        breadcrumb: result.breadcrumb,
        score: result.score,
      }));
    } finally {
      setIsSearching(false);
    }
  }, [query, division, fuzzySearch]);

  // Trigger AI matching when local search returns no results
  useEffect(() => {
    const performAIMatch = async () => {
      // Only trigger AI if:
      // 1. Query is at least 2 chars
      // 2. Local search returned no results
      // 3. Not already AI matching
      if (query.length >= 2 && results.length === 0 && !isAIMatching) {
        setIsAIMatching(true);
        setAIError(null);
        setAIMatches([]);

        try {
          const response = await fetch('/api/csi/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemDescription: query.trim(),
              maxMatches: 5,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI matching failed');
          }

          const data: CSIMappingResponse = await response.json();
          setAIMatches(
            data.matches.map((match) => ({
              code: match.code,
              title: match.title,
              level: match.level,
              confidence: match.confidence,
              reasoning: match.reasoning,
              breadcrumb: match.breadcrumb,
            }))
          );
        } catch (err) {
          console.error('AI matching error:', err);
          setAIError(err instanceof Error ? err.message : 'AI matching failed');
        } finally {
          setIsAIMatching(false);
        }
      } else if (query.length < 2 || results.length > 0) {
        // Clear AI results if query changed or local results found
        setAIMatches([]);
        setAIError(null);
      }
    };

    performAIMatch();
  }, [query, results.length]);

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (confidence >= 0.5) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-violet-500/20 text-violet-400 border-violet-500/50';
      case 2:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
      case 3:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 4:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  const renderEnhancedBreadcrumb = (breadcrumb: string[]) => {
    if (!breadcrumb || breadcrumb.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {breadcrumb.map((item, index) => {
          // Extract level from breadcrumb item (assumes format like "03 - Concrete" or "03 30 00 - Cast-in-Place Concrete")
          const codeMatch = item.match(/^([\d\s]+)/);
          const code = codeMatch ? codeMatch[1].trim() : '';
          const level = code.includes(' ') ? code.split(' ').filter(Boolean).length : 1;
          const levelColor = getLevelColor(level);

          return (
            <div key={index} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 bg-slate-900/60 rounded px-2 py-1 border border-slate-800">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded border font-mono ${levelColor}`}
                >
                  L{level}
                </span>
                <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                  {item}
                </span>
              </div>
              {index < breadcrumb.length - 1 && (
                <svg
                  className="w-3 h-3 text-slate-600 flex-shrink-0"
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
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-white">
            Search code or name
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">Fuzzy Search</span>
            <div className="relative group">
              <button
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Fuzzy search info"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <div className="absolute right-0 top-6 w-64 bg-slate-900 border border-slate-800 text-white text-xs rounded-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                <div className="relative">
                  <div className="absolute -top-3 right-2 w-2 h-2 bg-slate-900 transform rotate-45 border-l border-t border-slate-800"></div>
                  {fuzzySearch
                    ? 'Matches similar terms and handles typos (e.g., "concreet" finds "concrete")'
                    : 'Exact substring matching only'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setFuzzySearch(!fuzzySearch)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                fuzzySearch ? 'bg-violet-600' : 'bg-slate-700'
              }`}
              aria-label="Toggle fuzzy search"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  fuzzySearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter keyword or code (e.g., concrete, 03 30 00)..."
            className="w-full px-4 py-2 pr-10 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white placeholder-slate-500"
          />
          {query && !isSearching && (
            <button
              onClick={() => {
                setQuery('');
                setAIMatches([]);
                setAIError(null);
              }}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Clear search"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          {isSearching && (
            <div className="absolute right-3 top-3">
              <svg
                className="animate-spin h-5 w-5 text-violet-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Minimum 2 characters required</p>
      </div>

      {/* Division Filter */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Filter by Division (Optional)
        </label>
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-white"
        >
          <option value="">All Divisions</option>
          <option value="00">00 - Procurement and Contracting</option>
          <option value="01">01 - General Requirements</option>
          <option value="03">03 - Concrete</option>
          <option value="04">04 - Masonry</option>
          <option value="05">05 - Metals</option>
          <option value="06">06 - Wood, Plastics, and Composites</option>
          <option value="07">07 - Thermal and Moisture Protection</option>
          <option value="08">08 - Openings</option>
          <option value="09">09 - Finishes</option>
          <option value="10">10 - Specialties</option>
          <option value="21">21 - Fire Suppression</option>
          <option value="22">22 - Plumbing</option>
          <option value="23">23 - HVAC</option>
          <option value="26">26 - Electrical</option>
          <option value="27">27 - Communications</option>
          <option value="28">28 - Electronic Safety and Security</option>
          <option value="31">31 - Earthwork</option>
          <option value="32">32 - Exterior Improvements</option>
          <option value="33">33 - Utilities</option>
        </select>
      </div>

      {/* Results */}
      {query.length >= 2 && (
        <div className="space-y-2">
          {/* Local Search Results */}
          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {results.length} Results
                </h3>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {results.map((result) => (
                  <button
                    key={result.code}
                    onClick={() => onSelectCode(result.code, result.title)}
                    className="w-full text-left p-3 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-lg hover:border-violet-500/50 hover:shadow-xl transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-violet-400 group-hover:text-violet-300">
                            {result.code}
                          </span>
                          <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs font-medium rounded border border-violet-500/50">
                            Level {result.level}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 group-hover:text-white">
                          {result.title}
                        </p>
                      </div>
                      {result.breadcrumb.length > 1 && (
                        <div className="border-t border-slate-800 pt-2">
                          {renderEnhancedBreadcrumb(result.breadcrumb.slice(0, -1))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* AI Matching Indicator */}
          {results.length === 0 && isAIMatching && (
            <div className="bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-cyan-500/50 backdrop-blur-md rounded-lg p-6 text-center">
              <svg
                className="animate-spin h-10 w-10 text-cyan-500 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-white mb-1">
                AI Matching In Progress
              </h3>
              <p className="text-xs text-cyan-400">
                No local matches found. Using AI to find the best CSI codes for your query...
              </p>
            </div>
          )}

          {/* AI Error */}
          {results.length === 0 && aiError && !isAIMatching && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-400">
              {aiError}
            </div>
          )}

          {/* AI Results */}
          {results.length === 0 && aiMatches.length > 0 && !isAIMatching && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-cyan-500/50 backdrop-blur-md rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <h3 className="text-sm font-semibold text-white">
                    AI-Matched Results
                  </h3>
                </div>
                <p className="text-xs text-cyan-400">
                  No local matches found. AI found {aiMatches.length} potential {aiMatches.length === 1 ? 'match' : 'matches'}
                </p>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto">
                {aiMatches.map((match, index) => (
                  <button
                    key={match.code}
                    onClick={() => onSelectCode(match.code, match.title)}
                    className="w-full text-left p-4 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-lg hover:border-cyan-500/50 hover:shadow-xl transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-bold text-cyan-400 group-hover:text-cyan-300">
                              {match.code}
                            </span>
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded border border-cyan-500/50">
                              Level {match.level}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded border font-mono ${getConfidenceBadgeColor(
                                match.confidence
                              )}`}
                            >
                              {Math.round(match.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-200 group-hover:text-white mb-2">
                            {match.title}
                          </p>
                        </div>
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-2">
                          <p className="text-xs text-slate-300">
                            <span className="font-semibold text-cyan-400">Why this?</span> {match.reasoning}
                          </p>
                        </div>
                        {match.breadcrumb.length > 0 && (
                          <div className="border-t border-slate-800 pt-2">
                            {renderEnhancedBreadcrumb(match.breadcrumb)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Results (neither local nor AI) */}
          {results.length === 0 && aiMatches.length === 0 && !isAIMatching && !aiError && (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-10 w-10 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-3 text-sm font-medium text-white">No results found</h3>
              <p className="mt-1 text-xs text-slate-400">
                Try different keywords or check your spelling
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {query.length < 2 && results.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-white">Search CSI Codes</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
            Enter a keyword or code number to search through CSI MasterFormat 2018. You can
            also filter by division for more specific results.
          </p>
        </div>
      )}
    </div>
  );
}
