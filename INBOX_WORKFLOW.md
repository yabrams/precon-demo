# Inbox Workflow

Email-like inbox interface for managing incoming construction diagrams as the application's landing page.

## Overview

The inbox is the default entry point when users open the application. It displays diagram submissions with status tracking and provides a streamlined path to processing diagrams through the upload → extract → review workflow.

## Architecture Change

**Previous**: Dual-card workflow selection screen (upload vs inbox)
**Current**: Inbox-first approach - users land directly on inbox

### Workflow Modes

Defined in `app/page.tsx`:

```typescript
type WorkflowMode = 'inbox' | 'upload' | 'workspace';
```

- **inbox**: Landing page, shows all diagram submissions
- **upload**: Triggered by "New Diagram" button
- **workspace**: Viewing/editing a specific project

## Navigation Flow

```
Inbox (landing)
  ├─ Click "New Diagram" → Upload mode → Upload & Extract → Workspace
  └─ Click inbox item → Workspace (if pre-extracted data exists)
       └─ Click "Back to Inbox" → Returns to Inbox
```

## Data Structure

### InboxItem Interface

**Location**: `types/inbox.ts`

```typescript
interface InboxItem {
  id: string;
  sender: string;           // Person who submitted
  senderEmail: string;      // Email address
  subject: string;          // Diagram description
  receivedAt: number;       // Timestamp (Unix ms)
  diagramUrl: string;       // Path to diagram image
  thumbnailUrl?: string;    // Optional thumbnail
  status: InboxStatus;      // 'pending' | 'in_progress' | 'completed'
  projectId?: string;       // Links to project if processed
}
```

### Status States

- **pending**: Not yet processed, awaiting review
- **in_progress**: Currently being worked on
- **completed**: Extraction and review finished

## Components

### InboxListView (`components/InboxListView.tsx`)

Main inbox interface displaying all diagram submissions.

**Props**:
```typescript
{
  items: InboxItem[];
  onItemSelect: (item: InboxItem) => void;
  onNewDiagram: () => void;
}
```

**Features**:
- Status statistics (pending/in-progress/completed counts)
- Grid layout (2 columns on large screens)
- Empty state messaging
- "New Diagram" button for starting upload flow
- Animated entry (Framer Motion)

**Email Display**:
Shows special inbox email: `diagrams-todo@abramas.com`

### InboxCard (`components/InboxCard.tsx`)

Individual inbox item card with hover effects.

**Props**:
```typescript
{
  item: InboxItem;
  onClick: (item: InboxItem) => void;
}
```

**Visual Design**:
- Diagram thumbnail (24x24 px)
- Status badge with color coding:
  - Pending: Gray (`bg-gray-100`)
  - In Progress: Blue (`bg-blue-100`)
  - Completed: Green (`bg-green-100`)
- Sender avatar (first initial)
- Relative date formatting ("Today", "Yesterday", "3 days ago")
- Hover state: Border changes blue, lifts up 4px
- "View and process" indicator on hover

## Mock Data System

**Location**: `lib/mockInboxData.ts`

Provides demonstration data with 5 sample inbox items:

1. **Coca-Cola HQ Project** - Pending
   - Uses real extracted data from `lib/cokeExtractionData.json`
   - Pre-processed line items ready for display
2. **Building Floor Plans** - Pending
3. **Office Layout Revisions** - In Progress
4. **Electrical Diagram** - In Progress
5. **HVAC System Plans** - Completed

**Pre-extracted Line Items**:
```typescript
const mockInboxLineItems: Record<string, LineItem[]> = {
  'inbox-1': cokeHQLineItems,    // From extracted JSON
  'inbox-2': buildingPlansLineItems,
  'inbox-3': officeLayoutLineItems,
  // ...
};
```

## Integration with Main App

### State Management (app/page.tsx)

```typescript
const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('inbox');
const [inboxItems] = useState<InboxItem[]>(mockInboxItems);
```

### Event Handlers

**handleInboxItemSelect**:
- Creates new project from inbox item
- Loads pre-extracted line items if available
- Sets mode to 'workspace'
- Updates active project

**handleStartUploadFlow**:
- Sets mode to 'upload'
- Shows diagram upload component

**handleBackToInbox**:
- Sets mode to 'inbox'
- Clears active project
- Hides upload component

## UI Features

### Header Section
- Inbox icon with gradient background
- Title: "Inbox Diagrams"
- Email address display
- "New Diagram" button (prominent gradient styling)

### Statistics Dashboard
Three stat cards showing:
- Pending count (gray badge)
- In Progress count (blue badge)
- Completed count (green badge)

### Empty State
Shows when `items.length === 0`:
- Large inbox icon
- Message: "No diagrams in inbox"
- Instruction: "Diagrams sent to diagrams-todo@abramas.com will appear here"

## Date Formatting Logic

Intelligent relative date display:
```typescript
const formatDate = (timestamp: number) => {
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  // else: "Jan 15" or "Jan 15, 2024"
}
```

## Visual Design System

### Colors
- Primary: Blue gradient (`from-blue-600 to-indigo-600`)
- Background: Gradient (`from-gray-50 to-white`)
- Status colors: Gray, Blue, Green

### Animations
- Cards: Staggered entry (0.1s delay per item)
- Hover: Scale up to 1.02, lift -4px
- Tap: Scale down to 0.98
- Duration: 0.2-0.4s transitions

### Grid Layout
- Mobile: 1 column
- Large screens: 2 columns (`lg:grid-cols-2`)
- Gap: 1rem between cards

## Backend Integration (Future)

Current implementation uses mock data. Future email integration would:

1. Set up email forwarding to `diagrams-todo@abramas.com`
2. Parse incoming emails for:
   - Sender info (name, email)
   - Subject line
   - Diagram attachments
3. Store in database with `pending` status
4. Trigger auto-extraction (optional)
5. Update inbox view in real-time

## Configuration

**Inbox Email**: `diagrams-todo@abramas.com` (hardcoded in UI)

**Mock Data Generation**:
```typescript
const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;
const generateId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

## Key Implementation Details

### Why Inbox-First?

- Reduces friction: One less click to see projects
- Email-familiar pattern: Users understand inbox metaphor
- Clear status tracking: Visual progress indicators
- Demo-friendly: Mock data shows full workflow

### Workflow Mode Transitions

```typescript
// In app/page.tsx
{workflowMode === 'inbox' && (
  <InboxListView
    items={inboxItems}
    onItemSelect={handleInboxItemSelect}
    onNewDiagram={handleStartUploadFlow}
  />
)}

{workflowMode === 'upload' && showUpload && (
  <DiagramUpload onUploadComplete={handleUploadComplete} />
)}

{workflowMode === 'workspace' && activeProject && (
  <WorkspaceView {...} />
)}
```

### Header "Back to Inbox" Button

Only shown when not in inbox mode:
```typescript
{workflowMode !== 'inbox' && (
  <button onClick={handleBackToInbox}>
    Back to Inbox
  </button>
)}
```

## Future Enhancements

- Real email integration
- Inbox search and filtering
- Bulk actions (mark complete, delete)
- Sorting options (date, status, sender)
- Archive functionality
- Email notifications
- Attachment previews
- Priority flagging
