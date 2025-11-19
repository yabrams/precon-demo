# CSI MasterFormat Module

Comprehensive CSI MasterFormat 2018 integration module providing search, categorization, and AI-powered mapping capabilities for construction line items.

## Overview

This module provides a complete implementation of CSI MasterFormat 2018 (Levels 1-4) as a self-contained reference system for the preconstruction bidding application. It includes:

- **Complete CSI MasterFormat 2018 data** through Level 4 (detailed specifications)
- **Search API** for finding codes by keyword or code number
- **Category Tree API** for browsing hierarchical structure
- **AI Mapping API** for intelligently matching line items to CSI codes with confidence scores

## Architecture

### Hybrid Client-Server Architecture

The CSI module uses a **hybrid approach** for optimal performance:

- **Client-Side**: Search and browse operations (instant, offline-capable)
- **Server-Side**: AI mapping only (requires secure API keys)

```
lib/csi/                              # Core CSI module
├── masterformatData.json             # Complete CSI 2018 dataset (~500KB)
├── csiTypes.ts                       # Internal type definitions
├── csiClient.ts                      # ⚡ CLIENT-SIDE: Browser search & navigation
├── csiLookup.ts                      # SERVER-SIDE: Node.js search & navigation
└── csiMapper.ts                      # SERVER-SIDE: AI-powered mapping

types/csi.ts                          # Public-facing type exports

app/api/csi/                          # API routes (backward compatible)
├── search/route.ts                   # POST /api/csi/search (not used by widget)
├── categories/route.ts               # GET /api/csi/categories (not used by widget)
└── map/route.ts                      # POST /api/csi/map (used by AI Match tab)
```

### Performance Characteristics

**Client-Side Operations** (Search & Browse):
- ⚡ **<10ms** search latency (vs 300ms+ with API)
- 📱 **Works offline** - No network required
- 🎯 **Instant results** - No debounce needed for UX
- 💾 **One-time load** - Data bundled with application (~100KB gzipped)

**Server-Side Operations** (AI Match):
- 🔒 **Secure** - API keys never exposed to client
- 🤖 **Claude AI** - Requires backend processing
- ⏱️ **5-10 seconds** - AI analysis time
- 🌐 **Network required** - Must connect to API

## Data Structure

### CSI MasterFormat Hierarchy

The CSI MasterFormat 2018 is organized in 4 levels:

**Level 1: Division** (e.g., `"03" - Concrete`)
- 50 major divisions covering all construction work

**Level 2: Section** (e.g., `"03 30 00" - Cast-in-Place Concrete`)
- Broad categories within each division

**Level 3: Subsection** (e.g., `"03 31 00" - Structural Concrete`)
- Specific work types or materials

**Level 4: Detail** (e.g., `"03 31 13" - Heavyweight Structural Concrete`)
- Most specific classification level

### JSON Data Format

```json
{
  "version": "MasterFormat 2018",
  "divisions": [
    {
      "code": "03",
      "title": "Concrete",
      "level": 1,
      "parentCode": null,
      "division": "03",
      "children": [
        {
          "code": "03 30 00",
          "title": "Cast-in-Place Concrete",
          "level": 2,
          "parentCode": "03",
          "division": "03",
          "children": [...]
        }
      ]
    }
  ]
}
```

## Core Utilities

### Client-Side Module (`lib/csi/csiClient.ts`)

**Use this for browser/React components** - Provides instant, offline-capable search and navigation.

```typescript
import { searchCSICodes, getCategoryTree, getAllCSICodes } from '@/lib/csi/csiClient';
```

All functions are **synchronous** and return results instantly.

**Features:**
- ✨ **Fuzzy search** powered by Fuse.js
- 📦 **Caching** - Fuse instance and flattened data cached for performance
- 🚀 **Zero latency** - All operations happen in-memory
- 💪 **Typo tolerant** - Handles misspellings and partial matches

### Server-Side Module (`lib/csi/csiLookup.ts`)

**Use this for API routes and server components** - Same API as client module, but runs in Node.js.

```typescript
import { searchCSICodes, getCategoryTree } from '@/lib/csi/csiLookup';
```

### Search Functions

#### `searchCSICodes(options: CSISearchOptions): CSISearchResult[]`

Search CSI codes with flexible filtering and scoring.

```typescript
// Client-side (React components)
import { searchCSICodes } from '@/lib/csi/csiClient';

// Server-side (API routes)
import { searchCSICodes } from '@/lib/csi/csiLookup';

const results = searchCSICodes({
  query: 'concrete forming',
  divisions: ['03'],           // Optional: filter by divisions
  levels: [3, 4],              // Optional: filter by levels
  limit: 20,                   // Max results
  caseSensitive: false,
  exactMatch: false,
  fuzzySearch: true,           // NEW: Enable fuzzy search with Fuse.js (client-side only)
});

// Results include:
// - code: Full CSI code object
// - score: Relevance score (0-100+)
// - matchedFields: Which fields matched (code, title, description)
// - breadcrumb: Full hierarchical path
```

**Search Modes:**

1. **Fuzzy Search** (`fuzzySearch: true`, client-side only):
   - Uses Fuse.js for intelligent matching
   - Handles typos and misspellings (e.g., "concreet" → "concrete")
   - Matches partial words and similar terms
   - Weighted search: title (3x), code (2x), description (1x)
   - Threshold: 0.4 (0 = exact, 1 = match anything)
   - **Recommended for user-facing search interfaces**

2. **Substring Match** (`fuzzySearch: false`, default):
   - Fast substring matching using `.includes()`
   - Exact substring matching only
   - No typo tolerance
   - Custom relevance scoring (see below)

3. **Exact Match** (`exactMatch: true`):
   - Exact string equality only
   - Strictest matching mode
   - Use for code validation

**Scoring Algorithm (Substring Mode):**
- Exact code match: 100 points
- Code starts with query: 80 points
- Code contains query: 40 points
- Title exact match: 90 points
- Title starts with query: 60 points
- Title contains query: 30 points
- Description match: 20 points
- Bonus for higher-level codes: +3 to +5 points

**Fuzzy Search Scoring:**
- Based on Fuse.js similarity score (0-1, inverted to 0-100)
- Lower scores = better matches
- Automatically normalized to 0-100 scale

#### `getCategoryTree(options: CSICategoryOptions): CSICode[]`

Get hierarchical category structure.

```typescript
import { getCategoryTree } from '@/lib/csi/csiLookup';

// Get all divisions
const allDivisions = getCategoryTree();

// Get specific division with depth limit
const concreteTree = getCategoryTree({
  division: '03',
  maxDepth: 3,              // Only return through Level 3
  leafNodesOnly: false,     // Include parent nodes
});

// Get only leaf nodes (no children)
const leafCodes = getCategoryTree({
  division: '03',
  leafNodesOnly: true,
});
```

### Navigation Functions

#### `getCodeByCode(codeString: string): CSICode | null`

Retrieve a specific code by its code string.

```typescript
import { getCodeByCode } from '@/lib/csi/csiLookup';

const code = getCodeByCode('03 31 13');
// Returns: { code: "03 31 13", title: "Heavyweight Structural Concrete", ... }
```

#### `getBreadcrumb(codeString: string): string[]`

Get full hierarchical path for a code.

```typescript
import { getBreadcrumb } from '@/lib/csi/csiLookup';

const breadcrumb = getBreadcrumb('03 31 13');
// Returns: [
//   "03 - Concrete",
//   "03 30 00 - Cast-in-Place Concrete",
//   "03 31 00 - Structural Concrete",
//   "03 31 13 - Heavyweight Structural Concrete"
// ]
```

#### `getChildren(codeString: string): CSICode[]`

Get immediate children of a code.

```typescript
const children = getChildren('03 30 00');
// Returns all Level 3 codes under "03 30 00 - Cast-in-Place Concrete"
```

#### `getParent(codeString: string): CSICode | null`

Get parent of a code.

```typescript
const parent = getParent('03 31 13');
// Returns: { code: "03 31 00", title: "Structural Concrete", ... }
```

### Validation

#### `validateCode(codeString: string): CSIValidationResult`

Validate a CSI code and get suggestions if invalid.

```typescript
import { validateCode } from '@/lib/csi/csiLookup';

const result = validateCode('03 31 13');
// Returns: { isValid: true }

const invalid = validateCode('99 99 99');
// Returns: {
//   isValid: false,
//   error: "Code '99 99 99' not found in CSI MasterFormat 2018",
//   suggestions: ["03 31 13", "03 31 16", ...]
// }
```

### Statistics

#### `getDatasetStats(): CSIDatasetStats`

Get statistics about the CSI dataset.

```typescript
import { getDatasetStats } from '@/lib/csi/csiLookup';

const stats = getDatasetStats();
// Returns:
// {
//   totalCodes: 847,
//   countByLevel: { 1: 33, 2: 156, 3: 312, 4: 346 },
//   countByDivision: { "00": 5, "01": 8, "03": 67, ... },
//   version: "MasterFormat 2018"
// }
```

## AI Mapping Service (`lib/csi/csiMapper.ts`)

### `mapItemToCSI(description, context?, maxMatches?): Promise<CSIMappingResult>`

Use Claude AI to intelligently map construction items to CSI codes.

```typescript
import { mapItemToCSI } from '@/lib/csi/csiMapper';

const result = await mapItemToCSI(
  'Cast-in-place concrete foundation walls',
  {
    quantity: 150,
    unit: 'CY',
    notes: '3000 psi, 8" thick'
  },
  5  // Max matches to return
);

// Returns:
// {
//   itemDescription: "Cast-in-place concrete foundation walls",
//   matches: [
//     {
//       code: { code: "03 31 13", title: "Heavyweight Structural Concrete", ... },
//       confidence: 0.95,
//       reasoning: "Foundation walls are structural concrete applications...",
//       breadcrumb: ["03 - Concrete", ...]
//     },
//     {
//       code: { code: "03 11 13", title: "Structural Cast-in-Place Concrete Forming", ... },
//       confidence: 0.85,
//       reasoning: "Concrete walls require formwork...",
//       breadcrumb: [...]
//     }
//   ],
//   overallConfidence: "high",  // "high" | "medium" | "low"
//   matchCount: 2
// }
```

**Confidence Levels:**
- **High (0.8-1.0)**: Very clear match, high certainty
- **Medium (0.5-0.79)**: Reasonable match with some ambiguity
- **Low (0.0-0.49)**: Possible match but uncertain

### `batchMapItemsToCSI(items, maxMatchesPerItem?): Promise<CSIMappingResult[]>`

Map multiple items in batch with rate limiting.

```typescript
import { batchMapItemsToCSI } from '@/lib/csi/csiMapper';

const results = await batchMapItemsToCSI([
  { description: 'Steel rebar #5', quantity: 2000, unit: 'LF' },
  { description: 'CMU blocks 8"', quantity: 500, unit: 'SF' },
], 3);

// Returns array of CSIMappingResult
```

**Note:** Includes 500ms delay between items to avoid rate limiting.

## API Routes

### POST `/api/csi/search`

Search CSI codes by keyword or code number.

**Request:**
```json
{
  "query": "concrete",
  "division": "03",          // Optional
  "levels": [3, 4],          // Optional
  "limit": 20                // Optional, default: 20
}
```

**Response:**
```json
{
  "results": [
    {
      "code": "03 30 00",
      "title": "Cast-in-Place Concrete",
      "level": 2,
      "division": "03",
      "breadcrumb": ["03 - Concrete", "03 30 00 - Cast-in-Place Concrete"],
      "score": 85
    }
  ],
  "totalMatches": 15,
  "query": "concrete"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/csi/search \
  -H "Content-Type: application/json" \
  -d '{"query": "concrete forming", "limit": 10}'
```

### GET `/api/csi/categories`

Get hierarchical CSI category tree.

**Query Parameters:**
- `division` (optional): Filter by division (e.g., "03")
- `maxDepth` (optional): Max depth 1-4

**Examples:**
```bash
# Get all divisions
curl http://localhost:3000/api/csi/categories

# Get Concrete division through Level 3
curl http://localhost:3000/api/csi/categories?division=03&maxDepth=3

# Get all divisions, Level 1 only
curl http://localhost:3000/api/csi/categories?maxDepth=1
```

**Response:**
```json
{
  "categories": [
    {
      "code": "03",
      "title": "Concrete",
      "level": 1,
      "children": [
        {
          "code": "03 10 00",
          "title": "Concrete Forming and Accessories",
          "level": 2,
          "children": [...]
        }
      ]
    }
  ],
  "division": "03"
}
```

### POST `/api/csi/map`

Use AI to map a construction item to CSI codes.

**Request:**
```json
{
  "itemDescription": "Cast-in-place concrete foundation walls",
  "quantity": 150,           // Optional
  "unit": "CY",              // Optional
  "notes": "3000 psi",       // Optional
  "maxMatches": 5            // Optional, default: 5, max: 10
}
```

**Response:**
```json
{
  "itemDescription": "Cast-in-place concrete foundation walls",
  "matches": [
    {
      "code": "03 31 13",
      "title": "Heavyweight Structural Concrete",
      "level": 4,
      "division": "03",
      "breadcrumb": ["03 - Concrete", "03 30 00 - Cast-in-Place Concrete", ...],
      "confidence": 0.95,
      "reasoning": "Foundation walls are structural concrete applications..."
    }
  ],
  "overallConfidence": "high",
  "matchCount": 3
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/csi/map \
  -H "Content-Type: application/json" \
  -d '{
    "itemDescription": "Steel W-beam columns",
    "quantity": 12,
    "unit": "EA",
    "maxMatches": 3
  }'
```

**Error Responses:**

- `400 Bad Request`: Invalid input (missing description, invalid maxMatches, etc.)
- `500 Internal Server Error`: API key not configured or AI service failure

## TypeScript Types

### Public Types (`types/csi.ts`)

```typescript
import {
  CSICode,
  CSIDivision,
  CSILevel,
  CSISearchRequest,
  CSISearchResponse,
  CSICategoryRequest,
  CSICategoryResponse,
  CSIMappingRequest,
  CSIMappingResponse,
} from '@/types/csi';
```

### Core Interfaces

```typescript
interface CSICode {
  code: string;              // e.g., "03 31 13"
  title: string;
  level: 1 | 2 | 3 | 4;
  parentCode: string | null;
  division: string;
  description?: string;
  children?: CSICode[];
}

interface CSISearchResult {
  code: CSICode;
  score: number;
  matchedFields: ('code' | 'title' | 'description')[];
  breadcrumb: string[];
}

interface CSIMappingMatch {
  code: CSICode;
  confidence: number;        // 0.0 to 1.0
  reasoning: string;
  breadcrumb: string[];
}
```

## CSI Widget

A comprehensive floating widget accessible from any screen in the application, providing intelligent search and browsing capabilities for CSI MasterFormat data.

### Features

The CSI Widget provides a unified interface with two tabs:

1. **Search Tab**: Intelligent hybrid search combining local fuzzy matching with automatic AI fallback
2. **Browse Tab**: Hierarchical tree view of all divisions and codes

### Hybrid Search Workflow

The Search tab uses an intelligent two-tier approach:

1. **First Tier - Local Search** (instant, < 10ms):
   - Searches locally using client-side fuzzy matching (Fuse.js)
   - Returns results immediately with relevance scores
   - Works offline, no network latency
   - Displays results with blue accent colors

2. **Second Tier - AI Matching** (automatic fallback, 5-10s):
   - **Triggers only when local search returns no results**
   - Shows "AI Matching In Progress" indicator
   - Calls Claude AI backend for intelligent matching
   - Returns results with confidence scores and reasoning
   - Displays results with purple accent colors and "Why this?" explanations

This approach provides the best of both worlds: instant results when possible, with intelligent AI fallback for complex or ambiguous queries.

### Usage

The widget is accessible via a floating action button (FAB) in the bottom-right corner of the screen. Click to open, and use the tabs to navigate between different search modes.

### Components

**CSIWidget** (`components/CSIWidget.tsx`)
- Main widget container with tab navigation
- Slide-in panel from the right side
- Full-screen on mobile, 600px wide on desktop
- Backdrop overlay with click-to-close

**CSISearchTab** (`components/CSISearchTab.tsx`)
- 🔄 **Hybrid search** - Automatic fallback to AI when local search returns no results
- ⚡ Instant client-side search (< 10ms) for local matches
- 🔍 **Fuzzy search toggle** - Switch between fuzzy and exact matching
- 💪 Typo-tolerant search with Fuse.js
- 🤖 **Automatic AI matching** - Triggers when local search finds no results
- Division filter dropdown
- Results with relevance scores or confidence badges
- Breadcrumb path display
- "Why this?" reasoning for AI matches
- Works offline (local search only)

**CSIBrowseTab** (`components/CSIBrowseTab.tsx`)
- ⚡ Instant client-side tree loading
- Hierarchical tree view
- Expand/collapse nodes
- Level indicators (L1-L4)
- Expand All / Collapse All controls
- Color-coded by level
- Works offline

**CSIFloatingButton** (`components/CSIFloatingButton.tsx`)
- Fixed position button (bottom-right)
- Animated hover effects
- Tooltip on hover
- Always accessible

### Integration Example

```tsx
'use client';

import { useState } from 'react';
import CSIWidget from '@/components/CSIWidget';
import CSIFloatingButton from '@/components/CSIFloatingButton';

export default function MyApp() {
  const [csiWidgetOpen, setCsiWidgetOpen] = useState(false);

  const handleCSICodeSelect = (code: string, title: string) => {
    console.log('Selected CSI code:', code, title);
    // Handle code selection - e.g., add to form, copy to clipboard, etc.
  };

  return (
    <div>
      {/* Your app content */}

      {/* CSI Floating Button */}
      <CSIFloatingButton onClick={() => setCsiWidgetOpen(true)} />

      {/* CSI Widget */}
      <CSIWidget
        isOpen={csiWidgetOpen}
        onClose={() => setCsiWidgetOpen(false)}
        onSelectCode={handleCSICodeSelect}
      />
    </div>
  );
}
```

### Widget Props

**CSIWidget Props:**
```typescript
interface CSIWidgetProps {
  isOpen: boolean;                    // Control widget visibility
  onClose: () => void;                // Called when user closes widget
  onSelectCode?: (code: string, title: string) => void; // Called when code selected
}
```

**CSIFloatingButton Props:**
```typescript
interface CSIFloatingButtonProps {
  onClick: () => void;                // Called when button clicked
}
```

### Styling & Animations

- **Slide-in animation**: Smooth spring animation from right
- **Backdrop fade**: Animated backdrop with click-to-close
- **Tab transitions**: Instant tab switching with no animation
- **Hover effects**: Scale and shadow effects on floating button
- **Responsive design**: Full-screen on mobile, sidebar on desktop

### Keyboard Shortcuts

- **Escape**: Close widget
- **Tab navigation**: Navigate between tabs (not implemented yet)

## Integration Examples

### Frontend Component - CSI Code Picker

```typescript
'use client';

import { useState } from 'react';
import { CSISearchResponse } from '@/types/csi';

export function CSICodePicker({ onSelect }: { onSelect: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CSISearchResponse['results']>([]);

  const handleSearch = async () => {
    const response = await fetch('/api/csi/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 }),
    });
    const data = await response.json();
    setResults(data.results);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyUp={handleSearch}
        placeholder="Search CSI codes..."
      />
      <ul>
        {results.map((result) => (
          <li key={result.code} onClick={() => onSelect(result.code)}>
            <strong>{result.code}</strong> - {result.title}
            <br />
            <small>{result.breadcrumb.join(' > ')}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Backend - Auto-classify Line Items

```typescript
import { mapItemToCSI } from '@/lib/csi/csiMapper';
import { LineItem } from '@/components/BidFormTable';

async function autoClassifyLineItems(lineItems: LineItem[]) {
  const classified = [];

  for (const item of lineItems) {
    const mapping = await mapItemToCSI(item.description, {
      quantity: item.quantity || undefined,
      unit: item.unit || undefined,
      notes: item.notes || undefined,
    }, 1); // Get top match only

    if (mapping.matches.length > 0 && mapping.matches[0].confidence > 0.7) {
      classified.push({
        ...item,
        csiCode: mapping.matches[0].code.code,
        csiConfidence: mapping.matches[0].confidence,
      });
    }
  }

  return classified;
}
```

### Direct Library Usage

```typescript
import {
  getAllCSICodes,
  getCodesByDivision,
  validateCode
} from '@/lib/csi/csiLookup';

// Get all concrete codes
const concreteCodes = getCodesByDivision('03');

// Validate user input
const validation = validateCode(userInput);
if (!validation.isValid) {
  console.error(validation.error);
  console.log('Did you mean:', validation.suggestions);
}

// Get full dataset stats
const allCodes = getAllCSICodes();
console.log(`Total CSI codes available: ${allCodes.length}`);
```

## Performance Considerations

### Caching

The module implements automatic caching:
- **Flattened code array**: Cached on first access (`getAllCSICodes()`)
- **Search results**: Consider implementing React Query or SWR for frontend caching
- **AI mapping**: Results are not cached (each request is unique)

### Rate Limiting

The AI mapping service uses Claude API which has rate limits:
- **Batch operations**: Built-in 500ms delay between items
- **API endpoint**: 60-second timeout configured
- **Recommended**: Implement request queuing for bulk operations

### Data Size

- **JSON file size**: ~500KB compressed
- **Total codes**: ~850 codes across all levels
- **Load time**: Instant (static import)
- **Memory footprint**: Minimal (~2MB in memory)

## Future Enhancements

### Planned Features

1. **LineItem Integration**
   - Add `csiCode` field to LineItem interface
   - Auto-suggest CSI codes during extraction
   - Display CSI breadcrumb in bid table
   - Filter/group items by CSI division

2. **Cost Estimation**
   - Link CSI codes to cost databases (RSMeans)
   - Provide cost estimates based on classification
   - Historical cost tracking by CSI code

3. **Custom Classifications**
   - Allow users to add custom codes
   - Company-specific code extensions
   - Save frequently used codes

4. **Advanced Search**
   - Full-text search across descriptions
   - Synonym matching ("rebar" = "reinforcement bars")
   - Recently used codes
   - Favorite codes

5. **Batch Operations**
   - Bulk classify all line items at once
   - Export classified items by division
   - Validation reports

6. **UI Components**
   - CSI Code Picker dropdown
   - Hierarchical tree navigator
   - Visual division selector
   - Auto-complete search input

## Testing

### Manual Testing

```bash
# Test search API
curl -X POST http://localhost:3000/api/csi/search \
  -H "Content-Type: application/json" \
  -d '{"query": "concrete", "limit": 5}'

# Test categories API
curl http://localhost:3000/api/csi/categories?division=03&maxDepth=2

# Test mapping API
curl -X POST http://localhost:3000/api/csi/map \
  -H "Content-Type: application/json" \
  -d '{
    "itemDescription": "Structural steel beams",
    "quantity": 10,
    "unit": "EA"
  }'
```

### Unit Tests (Future)

```typescript
import { searchCSICodes, validateCode } from '@/lib/csi/csiLookup';

describe('CSI Lookup', () => {
  test('search returns results', () => {
    const results = searchCSICodes({ query: 'concrete', limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code.division).toBe('03');
  });

  test('validate code works', () => {
    expect(validateCode('03 31 13').isValid).toBe(true);
    expect(validateCode('99 99 99').isValid).toBe(false);
  });
});
```

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"

The AI mapping feature requires a valid Anthropic API key. Set it in your `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Search returns no results

- Check query length (minimum 2 characters)
- Verify division/level filters are valid
- Try broader search terms
- Check if data file loaded correctly

### AI mapping times out

- Default timeout is 60 seconds
- Complex items may take longer
- Consider breaking into smaller batches
- Check Anthropic API status

### Invalid CSI code format

CSI codes should match these patterns:
- Level 1: `"03"` (2 digits)
- Level 2: `"03 30 00"` (2 digits + space + 2 digits + space + 2 zeros)
- Level 3: `"03 31 00"` (similar pattern)
- Level 4: `"03 31 13"` (2 non-zero digits at end)

## License & Data Source

This implementation uses CSI MasterFormat 2018 structure. CSI MasterFormat is a registered trademark of the Construction Specifications Institute (CSI). The data structure and organization are standardized by CSI and used here for construction industry purposes.

## Support

For issues, questions, or feature requests related to the CSI module, please refer to:
- Main application: `/CLAUDE.md`
- Component reference: `/COMPONENTS_REFERENCE.md`
- GitHub issues: (Add your repo URL)
