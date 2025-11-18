# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An AI-powered preconstruction bidding application that converts construction diagrams into structured bid forms. The application uses Claude Sonnet 4.5 Vision API to extract bid line items from uploaded diagrams, presents them in an editable table with AI chat assistance, visual diagram linking, and exports to PDF/Excel/CSV formats.

**NEW FEATURES** (see dedicated documentation):
- **Inbox-first workflow**: Email-like landing page for diagram submissions (INBOX_WORKFLOW.md)
- **AI Chat Assistant**: Conversational interface for bid form updates (CHAT_SYSTEM.md)
- **Visual Features**: Bounding boxes, magnifying glass, diagram-to-table linking (VISUAL_FEATURES.md)
- **Component Reference**: Complete component API documentation (COMPONENTS_REFERENCE.md)

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server on http://localhost:3000

# Database
npx prisma generate      # Generate Prisma client (required after schema changes)
npx prisma db push       # Push schema changes to database
npx prisma studio        # Open Prisma Studio GUI on http://localhost:5555

# Build & Production
npm run build            # Build for production
npm start                # Start production server

# Linting
npm run lint             # Run ESLint
```

## Architecture

### State Management Pattern

The application uses a **single-page, multi-project architecture** where all state is managed in `app/page.tsx`:

- **Projects array**: In-memory state holding all projects with their diagrams and line items
- **Active project ID**: Tracks which project is currently displayed
- **Window-based temporary storage**: Uses `window.__newProjectId` to track newly created projects during the upload→extract flow

This pattern avoids database calls during active editing. The workflow is:
1. Upload creates new project in memory
2. Extract updates that project's line items
3. User edits update local state
4. Database schema exists but is currently unused (ready for future persistence)

### Component Architecture

**Three main views controlled by workflow mode in `app/page.tsx`:**

```typescript
type WorkflowMode = 'inbox' | 'upload' | 'workspace';
```

1. **Inbox View** (`InboxListView.tsx`): **Default landing page** showing all diagram submissions
2. **Upload View** (`DiagramUpload.tsx`): Triggered by "New Diagram" button from inbox
3. **Workspace View** (`WorkspaceView.tsx`): Shown when viewing/editing a specific project

**Key data flow:**
```
Inbox → Click "New Diagram" → Upload → Extract API → Workspace
Inbox → Click item → Workspace (with pre-extracted data)
Workspace → Click chat → AI Chat Assistant → Proposed changes
Table row hover ↔ Diagram bounding box highlight
```

### Component Hierarchy

```
app/page.tsx (state management hub)
│
├── InboxListView (NEW - landing page)
│   ├── InboxCard (multiple items)
│   └── "New Diagram" button → triggers upload mode
│
├── DiagramUpload
│   └── Handles: file upload, triggers extraction
│
└── WorkspaceView (resizable panels)
    ├── Left Panel: Diagram viewer
    │   ├── DiagramOverlay (NEW - bounding boxes)
    │   ├── MagnifyingGlass (NEW - zoom lens)
    │   └── ConnectionLine (NEW - table-to-diagram link)
    │
    └── Right Panel: BidFormTable OR ChatPanel
        ├── BidFormTable (when chat closed)
        │   └── Inline editing, add/delete rows, calculations
        │   └── Row hover triggers diagram highlighting
        │
        └── ChatPanel (NEW - when chat open)
            └── ChatMessage components
            └── Accept/Reject proposed changes
```

### API Routes

**`POST /api/upload`**: Uploads diagram file to local filesystem (`public/uploads/`)
- Returns: `{ url, fileName, fileSize, fileType }`
- Files stored at: `/uploads/[timestamp]-[filename]`

**`POST /api/extract`**: Extracts bid data using Claude Sonnet 4.5 Vision API
- Input: `{ imageUrl }` (local path or remote URL)
- Reads local files from `public/uploads/` or fetches remote URLs
- Uses structured prompt to extract: project name, line items with quantities, units, pricing
- **NEW**: Can also extract bounding boxes for visual linking
- Returns: `{ project_name, line_items[], extraction_confidence }`
- Handles both JSON blocks and inline JSON in Claude's response

**`POST /api/chat`** (NEW): Conversational AI for bid form updates
- Input: `{ message, imageUrl, currentLineItems, projectName, conversationHistory }`
- Two-phase workflow: Question detection → Confirmation → Change generation
- Returns: `{ response, proposedChanges[] }`
- See CHAT_SYSTEM.md for full documentation

### State Update Pattern

When extract completes, it updates the project that was just uploaded using `window.__newProjectId`:

```typescript
// Upload sets temporary ID
window.__newProjectId = newProject.id;

// Extract uses it to update correct project
const projectIdToUpdate = window.__newProjectId || activeProjectId;
setProjects(prev => prev.map(p =>
  p.id === projectIdToUpdate ? { ...p, lineItems: data.line_items } : p
));
```

### Export Functions (`lib/export.ts`)

Three export formats implemented as client-side functions:
- **PDF**: jsPDF with manual table layout, pagination at 270px
- **Excel**: XLSX library, includes header rows and totals
- **CSV**: Custom implementation with quoted strings for comma handling

## Database Schema (Prisma)

Schema is defined but **not currently used** in the application. Data lives in React state.

Models:
- `Project`: Container for diagrams and bid forms
- `Diagram`: File metadata and URLs
- `BidForm`: Extracted forms with status tracking
- `LineItem`: Individual bid items with pricing
- `VerificationRecord`: Audit trail (not implemented in UI yet)

All relations use `onDelete: Cascade` for data cleanup.

## Environment Variables

Required for development:
```env
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
POSTGRES_PRISMA_URL=postgres://...     # Database connection (unused in current version)
POSTGRES_URL_NON_POOLING=postgres://... # Direct database connection
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_... # Not currently used (local storage instead)
```

## UI/UX Patterns

### Framer Motion Animations

`AnimatePresence` with `mode="wait"` controls view transitions:
- Upload view fades and scales (0.95)
- Workspace view fades in
- Loading states animate opacity

### Resizable Panels

Uses `react-resizable-panels` for diagram/form split:
- Default: 35% diagram, 65% bid form
- Min sizes: 20% diagram, 30% form
- Only shown when diagram exists
- Styled handle with hover effect (gray → blue)

### Project Tabs

Horizontal scrollable tabs above workspace:
- Active tab: white background, blue border
- Inactive: gray background
- Hover shows delete button (X)
- Delete prevents event propagation to tab click

### Auto-calculations

BidFormTable automatically calculates `total_price = quantity × unit_price` on any change to those fields.

## Key Implementation Details

### Image Handling in Extract API

The extract route handles both local and remote images:
```typescript
if (imageUrl.startsWith('/uploads/')) {
  // Read from public/uploads/ directory
  const filepath = path.join(process.cwd(), 'public', imageUrl);
  const buffer = await readFile(filepath);
} else {
  // Fetch remote URL
  const response = await fetch(imageUrl);
}
```

### LineItem Interface

Critical interface used across components:
```typescript
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
  boundingBox?: {          // NEW - for visual linking
    x: number;             // Normalized 0-1 coordinates
    y: number;
    width: number;
    height: number;
  };
}
```

Note: All fields except `description` are optional/nullable for flexibility during extraction and editing.

## New Features Documentation

For detailed documentation on recently added features, see:
- **INBOX_WORKFLOW.md**: Inbox-first landing page, project status tracking
- **CHAT_SYSTEM.md**: AI assistant, two-phase confirmation workflow
- **VISUAL_FEATURES.md**: Bounding boxes, magnifying glass, connection lines
- **COMPONENTS_REFERENCE.md**: Complete component API reference

## Future Enhancements Ready

The codebase includes infrastructure for features not yet implemented:
- Database persistence (schema ready, not wired up)
- Email integration for inbox (currently uses mock data)
- Verification workflow (VerificationView component mentioned but not present)
- Multi-diagram projects (schema supports it)
- Vercel Blob Storage (can replace local uploads)

## TypeScript & Styling

- Strict TypeScript with explicit interfaces
- Tailwind CSS for all styling
- Component-scoped styles using className
- Responsive design with flexbox and grid
- Color scheme: Blue accents (#2563eb), gray backgrounds, white panels
