# Document Processing & Extraction Architecture

This document provides a comprehensive overview of how construction diagrams are uploaded, processed, and extracted into structured bid data in the preconstruction bidding application.

## Table of Contents

1. [Overview](#1-overview)
2. [API Endpoints](#2-api-endpoints)
3. [Client-Side Architecture](#3-client-side-architecture)
4. [Server-Side Processing](#4-server-side-processing)
5. [Extraction Pipeline](#5-extraction-pipeline)
6. [Flow Diagrams](#6-flow-diagrams)
7. [Data Models](#7-data-models)
8. [Error Handling & Recovery](#8-error-handling--recovery)
9. [Configuration & Environment](#9-configuration--environment)

---

## 1. Overview

### System Architecture

The document extraction system is a full-stack solution that converts construction diagrams (images and PDFs) into structured bid packages using AI-powered vision analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Next.js React)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  DiagramUpload.tsx  →  page.tsx (State Hub)  →  BidPackageWorkspace.tsx    │
│       ↓                      ↓                         ↓                    │
│   File Selection       Project/Package           Table + Diagram            │
│   + Instructions        Management               Visual Linking             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER (Next.js API Routes)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/upload          /api/extract-v2          /api/chat                   │
│       ↓                      ↓                      ↓                       │
│  File Storage         Claude Vision API       AI Chat Assistant            │
│  + Deduplication      + CSI Mapping           + Change Proposals           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Claude Sonnet 4.5 Vision API     │     PostgreSQL (Prisma)                │
│  - Diagram analysis               │     - Projects, Diagrams               │
│  - Bid item extraction            │     - BidPackages, BidForms            │
│  - Bounding box detection         │     - LineItems                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| State Management | React useState/useCallback in `page.tsx` |
| API Routes | Next.js API Routes (Edge-compatible) |
| AI Vision | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| Database | PostgreSQL with Prisma ORM |
| File Storage | Local filesystem or Vercel Blob Storage |
| PDF Processing | pdfjs-dist + Sharp |

### Key Components

| Component | Responsibility |
|-----------|---------------|
| `DiagramUpload.tsx` | File selection, drag-and-drop, upload triggering |
| `page.tsx` | Central state management hub for projects and packages |
| `BidPackageWorkspace.tsx` | Display extracted data with diagram linking |
| `/api/upload` | File storage with SHA-256 duplicate detection |
| `/api/extract-v2` | Claude Vision extraction with JSON repair |
| `/api/chat` | Two-phase AI assistant for bid modifications |
| `lib/csi/csiLookup.ts` | CSI MasterFormat code searching and matching |

---

## 2. API Endpoints

### POST /api/upload

Uploads diagram files with duplicate detection and optional database persistence.

**Location**: `app/api/upload/route.ts`

#### Request

```typescript
// Content-Type: multipart/form-data
interface UploadRequest {
  file: File;                    // Required: Image or PDF file
  bcProjectId?: string;          // Optional: Link to BuildingConnected project
  uploadedBy?: string;           // Optional: User identifier
}
```

**Supported file types**: JPEG, PNG, GIF, WebP, PDF (max 10MB)

#### Response

```typescript
interface UploadResponse {
  url: string;                   // File URL (e.g., "/uploads/1699900000000-abc123-diagram.png")
  fileName: string;              // Original filename
  fileSize: number;              // Size in bytes
  fileType: string;              // MIME type
  fileHash: string;              // SHA-256 hash for deduplication
  isDuplicate?: boolean;         // true if file already exists
  existingProjectId?: string;    // ID of project with duplicate file
  existingProjectName?: string;  // Name of project with duplicate file
  suggestedProjectName?: string; // AI-suggested name from filename
  diagram?: {                    // Database record (if bcProjectId provided)
    id: string;
    bcProjectId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    fileHash: string;
    createdAt: string;
    updatedAt: string;
  };
}
```

#### Example

```typescript
// Client-side upload
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('bcProjectId', 'proj_123');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
// result.url = "/uploads/1699900000000-xyz789-floor-plan.pdf"
```

---

### POST /api/extract-v2

Enhanced extraction endpoint with JSON repair and extended token limit.

**Location**: `app/api/extract-v2/route.ts`

#### Request

```typescript
interface ExtractRequest {
  imageUrl: string;              // Local path ("/uploads/...") or remote URL
  instructions?: string;         // Custom extraction instructions
  projectId?: string;            // Auto-create packages in this project
  diagramId?: string;            // Link extraction to diagram record
}
```

#### Response

```typescript
interface ExtractResponse {
  project_name: string | null;
  project_description: string | null;
  bid_packages: BidPackageExtraction[];
  extraction_confidence: 'high' | 'medium' | 'low';
  page_count?: number;           // For multi-page PDFs
  createdPackages?: CreatedPackage[];  // If projectId provided
  error?: string;                // If JSON repair was needed
}

interface BidPackageExtraction {
  name: string;                  // e.g., "Division 09 - Finishes"
  csi_division: string;          // e.g., "09"
  description: string;           // Brief scope description
  line_items: ExtractedLineItem[];
}

interface ExtractedLineItem {
  item_number: string | null;    // Exact number from document
  description: string;           // Complete work description
  quantity: number | null;       // Numeric quantity if specified
  unit: string | null;           // "LF", "SF", "EA", "CY", etc.
  notes: string | null;          // Additional specifications
  boundingBox: {                 // Normalized 0-1 coordinates
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  csiCode: string;               // Auto-matched CSI code
  csiTitle: string;              // CSI code title
}

interface CreatedPackage {
  bidPackage: {
    id: string;
    name: string;
    description: string;
    status: string;
  };
  bidForm: {
    id: string;
    lineItems: LineItem[];
  };
}
```

#### Example

```typescript
const response = await fetch('/api/extract-v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: '/uploads/1699900000000-floor-plan.pdf',
    instructions: 'Focus on electrical and plumbing items',
    projectId: 'proj_123',
    diagramId: 'diag_456'
  }),
});

const data = await response.json();
// data.bid_packages[0].line_items[0] = {
//   item_number: "E-101",
//   description: "Install 200A main electrical panel",
//   quantity: 1,
//   unit: "EA",
//   csiCode: "26 24 16",
//   csiTitle: "Panelboards"
// }
```

---

### POST /api/extract/batch

Processes multiple diagrams in parallel with combined results.

**Location**: `app/api/extract/batch/route.ts`

#### Request

```typescript
interface BatchExtractRequest {
  diagrams: DiagramInput[];
  bcProjectId?: string;          // Link to existing project
  createNewProject?: boolean;    // Create new project
  projectName?: string;          // Custom project name
  isDuplicate?: boolean;         // Handle as duplicate
  originalProjectId?: string;    // Reference to original
}

interface DiagramInput {
  diagramId: string;
  imageUrl: string;
  fileName: string;
  fileHash?: string;
}
```

#### Response

```typescript
interface BatchExtractResponse {
  success: boolean;
  projectId: string;
  projectName: string;
  message: string;
  bidPackages: {
    id: string;
    name: string;
    category: string;
    itemCount: number;
  }[];
  extractionResults: {
    diagramId: string;
    success: boolean;
    itemCount: number;
    confidence: 'high' | 'medium' | 'low';
    error?: string;
  }[];
}
```

**Timeout**: 300 seconds (5 minutes) for batch processing

---

### POST /api/chat

Two-phase AI assistant for conversational bid form modifications.

**Location**: `app/api/chat/route.ts`

#### Request

```typescript
interface ChatRequest {
  message: string;                    // User's message
  imageUrl?: string;                  // Diagram URL for context
  currentLineItems: LineItem[];       // Current bid items
  projectName: string;                // Project name for context
  conversationHistory?: ChatMessage[]; // Previous messages
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  proposedChanges?: ProposedChange[];
}
```

#### Response

```typescript
interface ChatResponse {
  response: string;                   // Assistant's text response
  proposedChanges?: ProposedChange[]; // Proposed modifications
}

interface ProposedChange {
  type: 'add' | 'update' | 'delete';

  // For 'add' operations
  newItem?: {
    id: string;                       // 6-char alphanumeric ID
    item_number?: string;
    description: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  };

  // For 'update' operations
  itemId?: string;
  newItem?: LineItem;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // For 'delete' operations
  itemId?: string;
}
```

#### Two-Phase Workflow

1. **Phase 1 - Detection**: Analyzes if message is a QUESTION or UPDATE REQUEST
   - Questions: Returns direct answer
   - Updates: Asks for confirmation

2. **Phase 2 - Confirmation**: After user confirms, generates `proposedChanges[]`

---

### POST /api/ai/extract-project-info

Extracts comprehensive project metadata from documents.

**Location**: `app/api/ai/extract-project-info/route.ts`

#### Request

```typescript
interface ProjectInfoRequest {
  documentUrls: string[];        // Array of document URLs
  documentNames: string[];       // Corresponding filenames
}
```

#### Response

```typescript
interface ProjectInfoResponse {
  success: boolean;
  projectInfo: {
    name: string | null;
    projectNumber: string | null;
    description: string | null;
    location: {
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: "USA";
    };
    bidDueDate: string | null;        // ISO date
    projectStartDate: string | null;
    projectEndDate: string | null;
    projectValue: number | null;
    marketSector: string | null;
    projectType: string | null;
    buildingType: string | null;
    ownerName: string | null;
    architectName: string | null;
    engineerName: string | null;
    generalContractorName: string | null;
    estimatedSquareFootage: number | null;
    numberOfFloors: number | null;
    bondingRequired: boolean | null;
    prevailingWageRequired: boolean | null;
    minorityBusinessGoal: number | null;
    womenBusinessGoal: number | null;
  };
  bidPackages: {
    name: string;
    description: string;
    budgetAmount: number | null;
  }[];
  confidence: {
    overall: number;             // 0-1 confidence score
    reasoning: string;
  };
  skippedFiles?: string[];       // PDFs not supported
}
```

---

## 3. Client-Side Architecture

### Component Hierarchy

```
app/page.tsx (State Management Hub)
│
├── InboxListView (Default landing page)
│   ├── InboxCard (Project items)
│   └── "New Diagram" button
│
├── DiagramUpload (File upload view)
│   ├── react-dropzone integration
│   ├── File preview
│   └── Instructions textarea
│
└── BidPackageWorkspace (Main editing view)
    ├── Left Panel: Diagram Viewer
    │   ├── DiagramOverlay (Bounding boxes)
    │   ├── MagnifyingGlass (Zoom lens)
    │   └── ConnectionLine (Table-diagram link)
    │
    └── Right Panel: BidFormTable OR ChatPanel
        ├── BidFormTable (Editable grid)
        └── ChatPanel (AI assistant)
```

### State Management in page.tsx

```typescript
// Core state variables
const [bcProjects, setBcProjects] = useState<BuildingConnectedProject[]>([]);
const [selectedProject, setSelectedProject] = useState<BuildingConnectedProject | null>(null);
const [selectedBidPackage, setSelectedBidPackage] = useState<BidPackageWorkspaceData | null>(null);
const [viewMode, setViewMode] = useState<'inbox' | 'upload' | 'reviewing' | 'packages' | 'workspace'>('inbox');
const [extracting, setExtracting] = useState(false);
const [pendingDiagram, setPendingDiagram] = useState<Diagram | null>(null);
```

### View Modes

| Mode | Description | Trigger |
|------|-------------|---------|
| `inbox` | Default landing, shows all projects | Initial load |
| `upload` | File upload interface | Click "New Diagram" |
| `reviewing` | Document categorization | After upload success |
| `packages` | Package selection (multi-package) | After extraction (multiple packages) |
| `workspace` | Main editing view | After extraction (single package) or package selection |

### Upload Flow (DiagramUpload.tsx)

```typescript
// 1. File selection via react-dropzone
const onDrop = useCallback(async (acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  setIsUploading(true);

  // 2. Upload to server
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bcProjectId', bcProjectId);

  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadedData = await uploadResponse.json();

  // 3. Store result and notify parent
  setUploadedFile(uploadedData);
  onUploadSuccess(uploadedData);
  setIsUploading(false);
}, [bcProjectId, onUploadSuccess]);

// 4. Trigger extraction
const handleExtract = () => {
  if (uploadedFile) {
    onExtractStart(uploadedFile.url, instructions);
  }
};
```

### Extraction Handler (page.tsx)

```typescript
const handleExtractStart = async (
  url: string,
  instructions?: string,
  bidPackageId?: string,
  diagramId?: string
) => {
  setExtracting(true);
  setViewMode('workspace');

  try {
    // 1. Call extraction API
    const response = await fetch('/api/extract-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        instructions,
        projectId: selectedProject?.id,
        diagramId
      }),
    });

    const data = await response.json();

    // 2. If packages created in database
    if (selectedProject?.id && data.createdPackages) {
      // 3. Reload projects from DB
      const freshProjects = await loadProjects();

      // 4. Update selected project reference
      const updatedProject = freshProjects.find(p => p.id === selectedProject?.id);
      if (updatedProject) {
        setSelectedProject(updatedProject);

        // 5. Auto-select if single package
        if (data.createdPackages.length === 1) {
          const createdPackageId = data.createdPackages[0].bidPackage.id;
          const updatedBidPackage = updatedProject.bidPackages?.find(
            bp => bp.id === createdPackageId
          );

          if (updatedBidPackage) {
            // 6. Transform DB items to LineItem interface
            const allLineItems = transformDBLineItems(updatedBidPackage);
            setSelectedBidPackage({
              ...updatedBidPackage,
              lineItems: allLineItems,
            });
          }
        } else {
          // Multiple packages: show selection view
          setViewMode('packages');
        }
      }
    }
  } finally {
    setExtracting(false);
  }
};
```

### Line Item Updates

```typescript
const handleLineItemsUpdate = async (updatedItems: LineItem[]) => {
  if (!selectedBidPackage) return;

  // 1. Update local state immediately (optimistic)
  setSelectedBidPackage({
    ...selectedBidPackage,
    lineItems: updatedItems,
  });

  // 2. Persist to database
  await fetch(`/api/bid-packages/${selectedBidPackage.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lineItems: updatedItems,
      chatMessages: selectedBidPackage.chatMessages,
    }),
  });
};
```

---

## 4. Server-Side Processing

### File Storage Strategy

```typescript
// app/api/upload/route.ts

// 1. Calculate file hash for deduplication
const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
const fileHash = await calculateBufferHash(buffer);

// 2. Check for duplicates
const existingDiagram = await prisma.diagram.findFirst({
  where: { fileHash }
});

if (existingDiagram) {
  return NextResponse.json({
    isDuplicate: true,
    existingProjectId: existingDiagram.bcProjectId,
    url: existingDiagram.fileUrl,
    // ...
  });
}

// 3. Determine storage method
let fileUrl: string;

if (process.env.BLOB_READ_WRITE_TOKEN) {
  // Production: Vercel Blob Storage
  const blob = await put(fileName, buffer, { access: 'public' });
  fileUrl = blob.url;
} else {
  // Development: Local filesystem
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const uniqueFileName = `${Date.now()}-${randomId}-${file.name}`;
  const filepath = path.join(uploadsDir, uniqueFileName);
  await writeFile(filepath, buffer);
  fileUrl = `/uploads/${uniqueFileName}`;
}

// 4. Create database record
const diagram = await prisma.diagram.create({
  data: {
    bcProjectId,
    fileName: file.name,
    fileUrl,
    fileType: file.type,
    fileSize: file.size,
    fileHash,
    uploadedBy,
  }
});
```

### Claude Vision API Integration

```typescript
// app/api/extract-v2/route.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 1. Load image as base64
let imageBase64: string;
let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

if (imageUrl.startsWith('/uploads/')) {
  // Local file
  const filepath = path.join(process.cwd(), 'public', imageUrl);
  const buffer = await readFile(filepath);
  imageBase64 = buffer.toString('base64');
  mediaType = detectMediaType(imageUrl);
} else {
  // Remote URL
  const response = await fetch(imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  imageBase64 = buffer.toString('base64');
  mediaType = detectMediaType(response.headers.get('content-type'));
}

// 2. Send to Claude Vision
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8000,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: extractionPrompt,  // See Section 5
        },
      ],
    },
  ],
});

// 3. Parse response
const responseText = message.content[0].type === 'text'
  ? message.content[0].text
  : '';
const result = parseExtractionResponse(responseText);
```

### PDF Multi-Page Processing

```typescript
// lib/pdf-utils.ts
import * as pdfjs from 'pdfjs-dist';
import sharp from 'sharp';

export async function processPDFForExtraction(
  pdfBuffer: Buffer,
  maxPages: number = 10
): Promise<{ images: string[]; pageCount: number }> {
  // 1. Load PDF document
  const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);

  const images: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    // 2. Get page
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    // 3. Render to canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    // 4. Convert to PNG
    const pngBuffer = await sharp(canvas.toBuffer())
      .png({ quality: 90 })
      .toBuffer();

    images.push(pngBuffer.toString('base64'));
  }

  return { images, pageCount };
}
```

### JSON Parsing with Repair

```typescript
// app/api/extract-v2/route.ts

function parseExtractionResponse(responseText: string): ExtractionResult {
  let jsonStr: string;

  // 1. Try markdown code fence
  if (responseText.includes('```json')) {
    const jsonStart = responseText.indexOf('```json') + 7;
    const jsonEnd = responseText.indexOf('```', jsonStart);
    jsonStr = responseText.substring(jsonStart, jsonEnd).trim();
  }
  // 2. Try direct JSON extraction
  else if (responseText.includes('{')) {
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}') + 1;
    jsonStr = responseText.substring(jsonStart, jsonEnd);
  }
  else {
    throw new Error('No JSON found in response');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 3. Attempt repair for truncated JSON
    return repairTruncatedJSON(jsonStr);
  }
}

function repairTruncatedJSON(jsonStr: string): ExtractionResult {
  let repairedJson = jsonStr;

  // Remove incomplete trailing elements
  repairedJson = repairedJson.replace(/,?\s*"[^"]*$/, '');
  repairedJson = repairedJson.replace(/,?\s*\{[^}]*$/, '');

  // Count brackets and braces
  const openBrackets = (repairedJson.match(/\[/g) || []).length;
  const closeBrackets = (repairedJson.match(/\]/g) || []).length;
  const openBraces = (repairedJson.match(/\{/g) || []).length;
  const closeBraces = (repairedJson.match(/\}/g) || []).length;

  // Close missing brackets
  for (let i = 0; i < (openBrackets - closeBrackets); i++) {
    repairedJson += ']';
  }

  // Close missing braces
  for (let i = 0; i < (openBraces - closeBraces); i++) {
    repairedJson += '}';
  }

  return JSON.parse(repairedJson);
}
```

---

## 5. Extraction Pipeline

### Claude Prompt Strategy

The extraction uses a two-step prompt approach:

```typescript
const extractionPrompt = `
Analyze this construction/preconstruction diagram or work drawing and extract bid packages and items.

TWO-STEP PROCESS:

STEP 1: IDENTIFY BID PACKAGES
Identify all bid packages based on CSI MasterFormat 2018 divisions visible in the document:
- Division 02: Existing Conditions
- Division 03: Concrete
- Division 04: Masonry
- Division 05: Metals
- Division 06: Wood, Plastics, Composites
- Division 07: Thermal and Moisture Protection
- Division 08: Openings
- Division 09: Finishes
- Division 10: Specialties
- Division 11: Equipment
- Division 12: Furnishings
- Division 13: Special Construction
- Division 14: Conveying Equipment
- Division 21: Fire Suppression
- Division 22: Plumbing
- Division 23: HVAC
- Division 26: Electrical
- Division 27: Communications
- Division 28: Electronic Safety and Security

STEP 2: EXTRACT LINE ITEMS
For each bid package, extract ALL line items visible. DO NOT skip any items.
For each item, extract:
- item_number: The exact number shown in the document (e.g., "E-101", "1.1", etc.)
- description: Complete text describing the work
- quantity: Numeric quantity if specified (can be null)
- unit: Unit of measurement (LF, SF, EA, CY, etc.) (can be null)
- notes: Additional specifications or requirements
- boundingBox: Normalized 0.0-1.0 coordinates for visual linking
  {
    "x": horizontal position (0 = left edge, 1 = right edge),
    "y": vertical position (0 = top edge, 1 = bottom edge),
    "width": width as fraction of image width,
    "height": height as fraction of image height
  }

IMPORTANT RULES:
1. Extract EVERY numbered item visible - do not skip any
2. Keep item numbers EXACTLY as shown in document
3. Do NOT truncate descriptions
4. If uncertain about a value, use null rather than guessing
5. Group items by their appropriate CSI division

${instructions ? `USER INSTRUCTIONS: ${instructions}` : ''}

Output ONLY valid JSON in this format:
{
  "project_name": "string or null",
  "project_description": "string or null",
  "bid_packages": [
    {
      "name": "Division XX - Description",
      "csi_division": "XX",
      "description": "Brief description of scope",
      "line_items": [
        {
          "item_number": "string or null",
          "description": "string",
          "quantity": "number or null",
          "unit": "string or null",
          "notes": "string or null",
          "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 } or null
        }
      ]
    }
  ],
  "extraction_confidence": "high" | "medium" | "low"
}
`;
```

### Bounding Box Extraction

Bounding boxes enable visual linking between table rows and diagram regions:

```typescript
interface BoundingBox {
  x: number;      // 0.0-1.0, left edge position
  y: number;      // 0.0-1.0, top edge position
  width: number;  // 0.0-1.0, box width
  height: number; // 0.0-1.0, box height
}

// Used in DiagramOverlay.tsx for highlighting
const boxStyle = {
  left: `${boundingBox.x * 100}%`,
  top: `${boundingBox.y * 100}%`,
  width: `${boundingBox.width * 100}%`,
  height: `${boundingBox.height * 100}%`,
};
```

### CSI MasterFormat Code Mapping

```typescript
// lib/csi/csiLookup.ts

interface CSISearchOptions {
  query: string;
  limit?: number;
  divisions?: string[];
  caseSensitive?: boolean;
}

interface CSISearchResult {
  code: {
    code: string;    // e.g., "09 30 00"
    title: string;   // e.g., "Tiling"
    level: number;   // 1-4
  };
  score: number;     // Relevance score
}

export function searchCSICodes(options: CSISearchOptions): CSISearchResult[] {
  const { query, limit = 3, divisions, caseSensitive = false } = options;

  // Score calculation:
  // - Exact code match: +100
  // - Code prefix match: +80
  // - Title contains query: +30-90 (based on position)
  // - Description contains query: +20
  // - Higher-level codes: +3-5 boost

  return scoredResults.slice(0, limit);
}

// Auto-mapping during extraction
function matchLineItemToCSI(
  description: string,
  csiDivision?: string
): { code: string; title: string } | null {
  const searchOptions: CSISearchOptions = {
    query: description,
    limit: 3,
    caseSensitive: false,
  };

  // Filter by division hint if available
  if (csiDivision && csiDivision !== '00') {
    searchOptions.divisions = [csiDivision];
  }

  const results = searchCSICodes(searchOptions);

  if (results.length > 0) {
    return {
      code: results[0].code.code,
      title: results[0].code.title,
    };
  }

  return null;  // Will use 'N/A' as fallback
}
```

### Trade Categorization Fallback

```typescript
// lib/bid-package-utils.ts

const TRADE_KEYWORDS: Record<string, string[]> = {
  PLUMBING: ['plumbing', 'pipe', 'drain', 'water', 'sewer', 'fixture', 'valve', 'pump'],
  ELECTRICAL: ['electrical', 'wire', 'outlet', 'panel', 'circuit', 'power', 'conduit', 'lighting'],
  HVAC: ['hvac', 'heating', 'cooling', 'duct', 'furnace', 'thermostat', 'ventilation', 'air conditioning'],
  FRAMING: ['framing', 'stud', 'joist', 'beam', 'structural', 'lumber', 'truss'],
  DRYWALL: ['drywall', 'gypsum', 'partition', 'ceiling', 'sheetrock'],
  FLOORING: ['flooring', 'carpet', 'tile', 'vinyl', 'hardwood', 'laminate'],
  ROOFING: ['roofing', 'shingle', 'membrane', 'gutter', 'flashing', 'roof'],
  CONCRETE: ['concrete', 'foundation', 'slab', 'rebar', 'cement', 'footing'],
  PAINTING: ['painting', 'paint', 'coating', 'primer', 'finish', 'stain'],
  LANDSCAPING: ['landscaping', 'irrigation', 'plant', 'tree', 'grass', 'lawn'],
  GENERAL_CONDITIONS: ['general conditions', 'supervision', 'temporary', 'mobilization'],
};

export function categorizeLineItem(description: string): string {
  const lowerDesc = description.toLowerCase();

  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return trade;
    }
  }

  return 'GENERAL';
}
```

---

## 6. Flow Diagrams

### Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant DC as DiagramUpload
    participant API as /api/upload
    participant FS as File Storage
    participant DB as Database

    U->>DC: Drop/Select file
    DC->>DC: Validate file type & size
    DC->>API: POST FormData (file, bcProjectId)
    API->>API: Calculate SHA-256 hash
    API->>DB: Check for duplicate hash

    alt Duplicate found
        DB-->>API: Return existing diagram
        API-->>DC: { isDuplicate: true, existingProjectId }
        DC-->>U: Show duplicate warning
    else New file
        API->>FS: Save file (local or Blob)
        FS-->>API: Return file URL
        API->>DB: Create Diagram record
        DB-->>API: Return diagram
        API-->>DC: { url, diagram, fileHash }
        DC-->>U: Show preview + instructions
    end
```

### Extraction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant P as page.tsx
    participant API as /api/extract-v2
    participant Claude as Claude Vision API
    participant CSI as CSI Lookup
    participant DB as Database

    U->>P: Click "Process Diagram"
    P->>P: setExtracting(true)
    P->>API: POST { imageUrl, projectId, instructions }

    API->>API: Load file (local/remote)

    alt PDF file
        API->>API: Convert pages to images
        loop Each page
            API->>Claude: Send image + prompt
            Claude-->>API: Return JSON response
        end
        API->>API: Combine page results
    else Image file
        API->>Claude: Send image + prompt
        Claude-->>API: Return JSON response
    end

    API->>API: Parse JSON (with repair if needed)

    loop Each line item
        API->>CSI: searchCSICodes(description)
        CSI-->>API: { code, title }
        API->>API: Attach CSI to item
    end

    alt projectId provided
        loop Each bid package
            API->>DB: Create BidPackage
            API->>DB: Create BidForm + LineItems
        end
    end

    API-->>P: { bid_packages, createdPackages }
    P->>P: loadProjects()
    P->>P: setSelectedBidPackage()
    P->>P: setViewMode('workspace')
    P-->>U: Show workspace with extracted data
```

### Complete End-to-End Flow

```mermaid
flowchart TD
    subgraph Client["Client (Browser)"]
        A[User lands on Inbox] --> B{Action?}
        B -->|New Diagram| C[DiagramUpload View]
        B -->|Select Project| D[Project Details]

        C --> E[Drop/Select File]
        E --> F[Upload to Server]
        F --> G{Duplicate?}
        G -->|Yes| H[Show Warning]
        G -->|No| I[Show Preview]

        I --> J[Add Instructions]
        J --> K[Click Process]
        K --> L[Extraction Loading]
        L --> M{Multiple Packages?}
        M -->|Yes| N[Package Selection]
        M -->|No| O[Workspace View]
        N --> O

        O --> P[Edit Line Items]
        O --> Q[Chat with AI]
        O --> R[Export PDF/Excel/CSV]

        P --> S[Auto-save to DB]
        Q --> T[Apply Changes]
        T --> S
    end

    subgraph Server["Server (API Routes)"]
        F --> U[/api/upload]
        U --> V[Hash + Store File]
        V --> W[Create Diagram Record]

        K --> X[/api/extract-v2]
        X --> Y[Load Image/PDF]
        Y --> Z[Claude Vision Analysis]
        Z --> AA[Parse JSON Response]
        AA --> AB[Match CSI Codes]
        AB --> AC[Create DB Records]

        Q --> AD[/api/chat]
        AD --> AE[Two-Phase Analysis]
        AE --> AF[Generate Changes]
    end

    subgraph External["External Services"]
        Z --> AG[Claude Sonnet 4.5]
        AC --> AH[PostgreSQL]
        S --> AH
    end
```

### Database Entity Relationships

```mermaid
erDiagram
    BuildingConnectedProject ||--o{ Diagram : contains
    BuildingConnectedProject ||--o{ BidPackage : contains
    BidPackage ||--o{ BidForm : contains
    BidForm ||--o{ LineItem : contains
    Diagram ||--o{ BidForm : linked

    BuildingConnectedProject {
        string id PK
        string name
        string description
        datetime createdAt
        datetime updatedAt
    }

    Diagram {
        string id PK
        string bcProjectId FK
        string fileName
        string fileUrl
        string fileType
        int fileSize
        string fileHash UK
        string uploadedBy
        datetime createdAt
    }

    BidPackage {
        string id PK
        string bcProjectId FK
        string bcBidPackageId UK
        string name
        string description
        string status
        json diagramIds
        datetime createdAt
    }

    BidForm {
        string id PK
        string bidPackageId FK
        string diagramId FK
        string extractionConfidence
        datetime createdAt
    }

    LineItem {
        string id PK
        string bidFormId FK
        string itemNumber
        string description
        float quantity
        string unit
        float unitPrice
        float totalPrice
        string notes
        string csiCode
        string csiTitle
        int order
        boolean verified
        datetime createdAt
    }
```

---

## 7. Data Models

### LineItem Interface (Core)

```typescript
// Used throughout the application
interface LineItem {
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
    x: number;      // 0-1 normalized horizontal position
    y: number;      // 0-1 normalized vertical position
    width: number;  // 0-1 normalized width
    height: number; // 0-1 normalized height
  } | null;
  csiCode?: string | null;     // Auto-matched CSI code
  csiTitle?: string | null;    // CSI code title
}

// Auto-calculation in BidFormTable
const calculateTotal = (item: LineItem): number | null => {
  if (item.quantity != null && item.unit_price != null) {
    return item.quantity * item.unit_price;
  }
  return null;
};
```

### BidPackage Structure

```typescript
interface BidPackageWorkspaceData {
  id: string;
  bcProjectId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'pending-review' | 'approved';
  diagramIds: string[];
  lineItems: LineItem[];
  bidForms?: BidForm[];
  chatMessages?: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface BidForm {
  id: string;
  bidPackageId: string;
  diagramId: string | null;
  extractionConfidence: 'high' | 'medium' | 'low' | null;
  lineItems: LineItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Diagram Schema (Prisma)

```prisma
model Diagram {
  id          String   @id @default(cuid())
  bcProjectId String
  fileName    String
  fileUrl     String
  fileType    String
  fileSize    Int
  fileHash    String?  @unique
  uploadedBy  String?
  category    String?
  description String?
  tags        String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project     BuildingConnectedProject @relation(fields: [bcProjectId], references: [id], onDelete: Cascade)
  bidForms    BidForm[]
}
```

### Chat Interfaces

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  proposedChanges?: ProposedChange[];
}

interface ProposedChange {
  type: 'add' | 'update' | 'delete';

  // For 'add' operations
  newItem?: {
    id: string;
    item_number?: string;
    description: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  };

  // For 'update' operations
  itemId?: string;
  newItem?: LineItem;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // For 'delete' operations
  itemId?: string;
}
```

---

## 8. Error Handling & Recovery

### Duplicate File Detection

```typescript
// app/api/upload/route.ts
import { createHash } from 'crypto';

async function calculateBufferHash(buffer: Buffer): Promise<string> {
  return createHash('sha256').update(buffer).digest('hex');
}

async function checkDuplicateFile(fileHash: string) {
  return prisma.diagram.findFirst({
    where: { fileHash },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });
}

// Usage in upload handler
const existingDiagram = await checkDuplicateFile(fileHash);

if (existingDiagram) {
  return NextResponse.json({
    isDuplicate: true,
    existingProjectId: existingDiagram.project?.id,
    existingProjectName: existingDiagram.project?.name,
    url: existingDiagram.fileUrl,
    fileName: existingDiagram.fileName,
    fileSize: existingDiagram.fileSize,
    fileType: existingDiagram.fileType,
    fileHash,
  });
}
```

### Truncated JSON Repair Algorithm

```typescript
// app/api/extract-v2/route.ts

function repairTruncatedJSON(jsonStr: string): any {
  let repairedJson = jsonStr;

  // Step 1: Remove incomplete trailing string
  repairedJson = repairedJson.replace(/,?\s*"[^"]*$/, '');

  // Step 2: Remove incomplete trailing object
  repairedJson = repairedJson.replace(/,?\s*\{[^}]*$/, '');

  // Step 3: Remove incomplete trailing array element
  repairedJson = repairedJson.replace(/,?\s*\[[^\]]*$/, '');

  // Step 4: Remove trailing comma
  repairedJson = repairedJson.replace(/,\s*$/, '');

  // Step 5: Count and balance brackets
  const openBrackets = (repairedJson.match(/\[/g) || []).length;
  const closeBrackets = (repairedJson.match(/\]/g) || []).length;
  const openBraces = (repairedJson.match(/\{/g) || []).length;
  const closeBraces = (repairedJson.match(/\}/g) || []).length;

  // Step 6: Close missing brackets
  for (let i = 0; i < (openBrackets - closeBrackets); i++) {
    repairedJson += ']';
  }

  // Step 7: Close missing braces
  for (let i = 0; i < (openBraces - closeBraces); i++) {
    repairedJson += '}';
  }

  return JSON.parse(repairedJson);
}
```

### Multi-Page PDF Result Combination

```typescript
// app/api/extract-v2/route.ts

function combinePageResults(
  pageResults: ExtractionResult[]
): ExtractionResult {
  const combinedPackages = new Map<string, BidPackageExtraction>();

  for (const result of pageResults) {
    for (const pkg of result.bid_packages) {
      const key = `${pkg.csi_division}-${pkg.name}`;

      if (combinedPackages.has(key)) {
        // Merge line items into existing package
        const existing = combinedPackages.get(key)!;
        existing.line_items.push(...pkg.line_items.map(item => ({
          ...item,
          notes: item.notes
            ? `${item.notes} (Page ${pageResults.indexOf(result) + 1})`
            : `Page ${pageResults.indexOf(result) + 1}`
        })));
      } else {
        // Add new package
        combinedPackages.set(key, { ...pkg });
      }
    }
  }

  // Calculate overall confidence (minimum of all pages)
  const confidenceLevels = { high: 3, medium: 2, low: 1 };
  const minConfidence = Math.min(
    ...pageResults.map(r => confidenceLevels[r.extraction_confidence])
  );
  const overallConfidence = Object.entries(confidenceLevels)
    .find(([_, v]) => v === minConfidence)?.[0] as 'high' | 'medium' | 'low';

  return {
    project_name: pageResults[0]?.project_name || null,
    project_description: pageResults[0]?.project_description || null,
    bid_packages: Array.from(combinedPackages.values()),
    extraction_confidence: overallConfidence,
    page_count: pageResults.length,
  };
}
```

### Fallback Default Structure

```typescript
// Used when extraction fails completely
const DEFAULT_EXTRACTION_RESULT: ExtractionResult = {
  project_name: null,
  project_description: null,
  bid_packages: [{
    name: 'GENERAL',
    csi_division: '00',
    description: 'General bid items',
    line_items: []
  }],
  extraction_confidence: 'low',
  raw_text: undefined  // Will contain truncated response text for debugging
};
```

---

## 9. Configuration & Environment

### Required Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...          # Claude API key

# Database (optional - for persistence)
POSTGRES_PRISMA_URL=postgres://user:pass@host:5432/db?schema=public
POSTGRES_URL_NON_POOLING=postgres://user:pass@host:5432/db

# File Storage (optional - uses local if not set)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...    # Vercel Blob Storage token
```

### API Configuration Parameters

| Parameter | Value | Endpoint |
|-----------|-------|----------|
| Claude Model | `claude-sonnet-4-5-20250929` | All extraction routes |
| Max Tokens (standard) | 4096 | `/api/extract`, `/api/chat` |
| Max Tokens (enhanced) | 8000 | `/api/extract-v2` |
| Max Duration | 60 seconds | Standard routes |
| Max Duration (batch) | 300 seconds | `/api/extract/batch` |
| PDF Max Pages | 10 | All PDF processing |
| PDF Scale Factor | 2.0 | Image quality |
| File Max Size | 10 MB | Upload validation |

### Model Configuration

```typescript
// Anthropic client configuration
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Standard extraction
const extractionConfig = {
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8000,
  temperature: 0,  // Deterministic output
};

// Chat assistant
const chatConfig = {
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  temperature: 0.3,  // Slight creativity for responses
};
```

### File Type Support

| Type | MIME | Supported |
|------|------|-----------|
| JPEG | image/jpeg | Yes |
| PNG | image/png | Yes |
| GIF | image/gif | Yes |
| WebP | image/webp | Yes |
| PDF | application/pdf | Yes (converted to images) |

---

## Appendix: Key File Locations

| File | Purpose |
|------|---------|
| `app/api/upload/route.ts` | File upload endpoint |
| `app/api/extract/route.ts` | Standard extraction |
| `app/api/extract-v2/route.ts` | Enhanced extraction |
| `app/api/extract/batch/route.ts` | Batch processing |
| `app/api/chat/route.ts` | AI chat assistant |
| `app/page.tsx` | State management hub |
| `components/DiagramUpload.tsx` | Upload component |
| `components/BidPackageWorkspace.tsx` | Main workspace |
| `components/BidFormTable.tsx` | Editable line items table |
| `components/ChatPanel.tsx` | Chat interface |
| `lib/csi/csiLookup.ts` | CSI code searching |
| `lib/csi/csiMapper.ts` | AI-powered CSI mapping |
| `lib/pdf-utils.ts` | PDF processing |
| `lib/bid-package-utils.ts` | Trade categorization |
| `prisma/schema.prisma` | Database schema |
