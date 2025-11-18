# Components Reference

Quick reference for all React components in the precon application.

## Chat Components

### ChatPanel
**File**: `components/ChatPanel.tsx`

Conversational AI interface for asking questions and requesting bid form updates.

```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onAcceptChanges: (messageId: string) => void;
  onRejectChanges: (messageId: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
}
```

**Features**:
- Auto-scroll to latest message
- Quick reply buttons (Yes/No)
- Numbered question template detection
- Animated loading state
- Textarea with Shift+Enter for new line

**Usage**:
```tsx
<ChatPanel
  messages={chatMessages}
  onSendMessage={handleSendMessage}
  onAcceptChanges={handleAcceptChanges}
  onRejectChanges={handleRejectChanges}
  isLoading={isChatLoading}
  onClose={handleChatToggle}
/>
```

### ChatMessage
**File**: `components/ChatMessage.tsx`

Individual message display with proposed changes UI.

```typescript
interface ChatMessageProps {
  message: ChatMessage;
  onAcceptChanges: (messageId: string) => void;
  onRejectChanges: (messageId: string) => void;
}
```

**Features**:
- Markdown rendering
- Syntax-highlighted code blocks
- Accept/Reject buttons for proposed changes
- Change summary display
- User/Assistant styling differentiation

**Usage**:
```tsx
<ChatMessage
  message={message}
  onAcceptChanges={onAcceptChanges}
  onRejectChanges={onRejectChanges}
/>
```

## Inbox Components

### InboxListView
**File**: `components/InboxListView.tsx`

Landing page showing all diagram submissions in email-like layout.

```typescript
interface InboxListViewProps {
  items: InboxItem[];
  onItemSelect: (item: InboxItem) => void;
  onNewDiagram: () => void;
}
```

**Features**:
- Status statistics (pending/in-progress/completed counts)
- Grid layout (responsive: 1 col mobile, 2 col desktop)
- Empty state messaging
- Staggered animation on entry
- "New Diagram" CTA button

**Usage**:
```tsx
<InboxListView
  items={inboxItems}
  onItemSelect={handleInboxItemSelect}
  onNewDiagram={handleStartUploadFlow}
/>
```

### InboxCard
**File**: `components/InboxCard.tsx`

Individual inbox item card with diagram thumbnail.

```typescript
interface InboxCardProps {
  item: InboxItem;
  onClick: (item: InboxItem) => void;
}
```

**Features**:
- Diagram thumbnail (96x96px)
- Status badge with color coding
- Sender avatar (first initial)
- Relative date formatting
- Hover animation (scale 1.02, lift -4px)
- "View and process" hover indicator

**Usage**:
```tsx
<InboxCard
  item={inboxItem}
  onClick={onItemSelect}
/>
```

## Visual Feature Components

### DiagramOverlay
**File**: `components/DiagramOverlay.tsx`

SVG overlay rendering bounding boxes on diagrams.

```typescript
interface DiagramOverlayProps {
  lineItems: LineItem[];
  hoveredItemId: string | null;
  onHoverChange: (itemId: string | null) => void;
  imageWidth: number;
  imageHeight: number;
}
```

**Features**:
- 10-color pastel palette (cycled by index)
- Corner dot indicators (not hovered)
- Full bounding box highlight (hovered)
- Normalized coordinate conversion
- Framer Motion animations

**Usage**:
```tsx
<DiagramOverlay
  lineItems={lineItems}
  hoveredItemId={hoveredItemId}
  onHoverChange={setHoveredItemId}
  imageWidth={imageDimensions.width}
  imageHeight={imageDimensions.height}
/>
```

### MagnifyingGlass
**File**: `components/MagnifyingGlass.tsx`

Canvas-based zoom lens following mouse cursor.

```typescript
interface MagnifyingGlassProps {
  imageSrc: string;
  imageRef: React.RefObject<HTMLImageElement>;
  zoomFactor?: number;    // Default: 2.5
  lensWidth?: number;     // Default: 250
  lensHeight?: number;    // Default: 150
  enabled: boolean;
}
```

**Features**:
- Real-time canvas drawing
- Full-resolution image source
- Configurable zoom level
- Zoom indicator badge
- 20px offset from cursor
- Blue border and shadow

**Usage**:
```tsx
<MagnifyingGlass
  imageSrc={diagramUrl}
  imageRef={diagramImageRef}
  zoomFactor={2.5}
  enabled={magnifyEnabled}
/>
```

### ConnectionLine
**File**: `components/ConnectionLine.tsx`

Animated curved SVG path linking table rows to diagram regions.

```typescript
interface ConnectionLineProps {
  hoveredItemId: string | null;
  color: string;
  fromElement: HTMLElement | null;
  toX: number;
  toY: number;
}
```

**Features**:
- Quadratic Bézier curve path
- Animated drawing effect (pathLength)
- Circle endpoint marker
- Responsive position updates
- 300ms animation duration

**Usage**:
```tsx
<ConnectionLine
  hoveredItemId={hoveredItemId}
  color={highlightColor}
  fromElement={tableRowElement}
  toX={boundingBoxCenterX}
  toY={boundingBoxCenterY}
/>
```

## Core Workflow Components

### DiagramUpload
**File**: `components/DiagramUpload.tsx`

File upload interface with drag-and-drop support.

```typescript
interface DiagramUploadProps {
  onUploadComplete: (result: {
    url: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }) => void;
}
```

**Features**:
- Drag-and-drop zone
- File input fallback
- Loading state with progress indicator
- Error handling and display
- File type validation
- Animated upload success

**Usage**:
```tsx
<DiagramUpload
  onUploadComplete={handleUploadComplete}
/>
```

### BidFormTable
**File**: `components/BidFormTable.tsx`

Editable table for line items with inline editing.

```typescript
interface BidFormTableProps {
  lineItems: LineItem[];
  onLineItemsUpdate: (items: LineItem[]) => void;
  onRowHover?: (itemId: string | null) => void;
  hoveredItemId?: string | null;
}
```

**Features**:
- Inline cell editing (double-click or click)
- Auto-calculation (total = quantity × unit_price)
- Add/delete rows
- Grand total calculation
- Row hover highlighting
- Bounding box color indicators
- Keyboard navigation (Tab, Enter)

**Usage**:
```tsx
<BidFormTable
  lineItems={lineItems}
  onLineItemsUpdate={handleLineItemsUpdate}
  onRowHover={setHoveredItemId}
  hoveredItemId={hoveredItemId}
/>
```

### WorkspaceView
**File**: `components/WorkspaceView.tsx`

Main workspace with resizable panels for diagram and bid form.

```typescript
interface WorkspaceViewProps {
  diagramUrl: string | null;
  lineItems: LineItem[];
  isExtracting: boolean;
  onLineItemsUpdate: (items: LineItem[]) => void;
  onUploadNew: () => void;
  onReExtract?: (instructions: string) => void;
  projectName?: string;
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  onChatToggle: () => void;
  onSendChatMessage: (message: string) => void;
  onAcceptChatChanges: (messageId: string) => void;
  onRejectChatChanges: (messageId: string) => void;
  isChatLoading?: boolean;
}
```

**Features**:
- Resizable panels (35/65 default split)
- Diagram viewer with zoom/pan
- Export buttons (PDF, Excel, CSV)
- Chat panel toggle
- Visual features integration
- Magnifying glass toggle
- Loading states

**Usage**:
```tsx
<WorkspaceView
  diagramUrl={project.diagramUrl}
  lineItems={project.lineItems}
  isExtracting={extracting}
  onLineItemsUpdate={handleLineItemsUpdate}
  onUploadNew={handleUploadNew}
  projectName={project.name}
  chatOpen={project.chatOpen}
  chatMessages={project.chatMessages}
  onChatToggle={handleChatToggle}
  onSendChatMessage={handleSendChatMessage}
  onAcceptChatChanges={handleAcceptChatChanges}
  onRejectChatChanges={handleRejectChatChanges}
  isChatLoading={chatLoading}
/>
```

## Component Hierarchy

```
app/page.tsx (state management)
│
├─ InboxListView
│  └─ InboxCard (multiple)
│
├─ DiagramUpload
│  └─ (internal file input and drag-drop UI)
│
└─ WorkspaceView
   ├─ Panel (left): Diagram viewer
   │  ├─ <img> (diagram)
   │  ├─ DiagramOverlay
   │  ├─ MagnifyingGlass
   │  └─ ConnectionLine
   │
   └─ Panel (right): Bid form or Chat
      ├─ BidFormTable (when chat closed)
      │  └─ (table rows with inline editing)
      │
      └─ ChatPanel (when chat open)
         └─ ChatMessage (multiple)
```

## Common Patterns

### State Lifting
All major state managed in `app/page.tsx`:
- Projects array
- Active project ID
- Workflow mode
- Chat state
- Hover state

Components receive state and callbacks via props.

### Event Handlers
Naming convention: `handle[Action]` in parent, `on[Action]` in props

```typescript
// Parent (page.tsx)
const handleLineItemsUpdate = (items: LineItem[]) => { /* ... */ };

// Child component
<BidFormTable
  onLineItemsUpdate={handleLineItemsUpdate}
/>
```

### Hover Synchronization
Bidirectional hover between table and diagram:
- Table row hover → `onRowHover(itemId)` → Update state → Diagram highlights
- Diagram box hover → `onHoverChange(itemId)` → Update state → Table row highlights

### Framer Motion
Consistent animation patterns:
- `initial`: Starting state (opacity: 0, y: 20)
- `animate`: End state (opacity: 1, y: 0)
- `exit`: Unmount state (opacity: 0)
- `transition`: Duration and easing

### Responsive Design
- Tailwind breakpoints: `sm:`, `md:`, `lg:`
- Grid columns: `grid-cols-1 lg:grid-cols-2`
- Flexbox for layouts: `flex flex-col` or `flex gap-4`

## Styling Conventions

### Gradients
```css
bg-gradient-to-r from-blue-600 to-indigo-600  /* Buttons */
bg-gradient-to-b from-gray-50 to-white        /* Backgrounds */
bg-gradient-to-br from-blue-500 to-indigo-600 /* Icons */
```

### Borders
```css
border-2 border-gray-200          /* Cards */
border-2 border-blue-400          /* Hover */
rounded-xl                        /* Large radius */
rounded-lg                        /* Medium radius */
```

### Shadows
```css
shadow-sm          /* Subtle */
shadow-lg          /* Cards */
shadow-2xl         /* Magnifying glass */
shadow-blue-500/30 /* Colored glow */
```

### Transitions
```css
transition-all duration-200  /* Fast */
transition-all duration-300  /* Medium */
transition-all duration-400  /* Slow */
```

## Type Definitions

### LineItem
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
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  proposedChanges?: ProposedChange[];
}
```

### InboxItem
```typescript
interface InboxItem {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: number;
  diagramUrl: string;
  thumbnailUrl?: string;
  status: 'pending' | 'in_progress' | 'completed';
  projectId?: string;
}
```

## Testing Considerations

### Component Testing
Each component should be testable in isolation:
- Render with required props
- Simulate user interactions
- Verify callbacks invoked
- Check visual states

### Integration Points
Key integration areas:
- Upload → Extract API → Workspace
- Table hover → Diagram highlight
- Chat → Line items update
- Inbox → Project creation
