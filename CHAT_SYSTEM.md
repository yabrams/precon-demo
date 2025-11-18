# Chat System

AI-powered conversational assistant for interacting with bid forms using Claude Sonnet 4.5.

## Overview

The chat system enables users to ask questions about diagrams and request modifications to line items through natural language. It uses a two-phase confirmation workflow to ensure users approve changes before they're applied.

## Architecture

### API Route: `/api/chat`

**Location**: `app/api/chat/route.ts`

**Request** (`ChatRequest`):
```typescript
{
  message: string;                    // User's message
  imageUrl: string;                   // Diagram URL
  currentLineItems: LineItem[];       // Current bid form state
  projectName: string;                // Project context
  conversationHistory?: ChatMessage[]; // Previous messages
}
```

**Response** (`ChatResponse`):
```typescript
{
  response: string;                   // AI's text response
  proposedChanges?: ProposedChange[]; // Changes to apply (if confirmed)
}
```

## Two-Phase Workflow

### Phase 1: Intent Detection & Confirmation

When user sends a message, Claude analyzes intent:

**QUESTION**: User asks for information
- Example: "What materials are shown?"
- Response: Direct answer, no changes proposed

**UPDATE REQUEST**: User wants to modify line items
- Example: "Set all quantities to 1"
- Response: Ask for confirmation, explain what will change
- No `proposedChanges` generated yet

### Phase 2: Change Generation

After user confirms (keywords: yes, confirm, proceed, go ahead, do it, please, sure, ok, okay):
- Claude generates structured `proposedChanges` array
- User can accept or reject changes in UI
- Changes applied to state only upon acceptance

## ProposedChange Types

### Add New Item
```typescript
{
  type: 'add',
  newItem: {
    id: 'a3X9k2',              // 6-char random alphanumeric
    item_number: '2.1',
    description: 'New item',
    quantity: 4,
    unit: 'EA',
    unit_price: 100,
    total_price: 400,          // auto-calculated
    notes: 'Optional'
  }
}
```

### Update Existing Item
```typescript
{
  type: 'update',
  itemId: 'existing-id',
  newItem: { /* complete updated item */ },
  changes: [
    { field: 'quantity', oldValue: 5, newValue: 1 },
    { field: 'unit_price', oldValue: 50, newValue: 100 }
  ]
}
```

### Delete Item
```typescript
{
  type: 'delete',
  itemId: 'item-to-delete'
}
```

## Components

### ChatPanel (`components/ChatPanel.tsx`)

Main chat interface component.

**Props**:
```typescript
{
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
- Quick reply buttons for yes/no questions
- Numbered question detection (auto-populates template)
- Loading state with animated dots
- Markdown rendering support

### ChatMessage (`components/ChatMessage.tsx`)

Individual message display with accept/reject controls for proposed changes.

**Props**:
```typescript
{
  message: ChatMessage;
  onAcceptChanges: (messageId: string) => void;
  onRejectChanges: (messageId: string) => void;
}
```

## State Management

Chat messages stored in project state (`app/page.tsx`):

```typescript
interface Project {
  id: string;
  name: string;
  diagramUrl: string | null;
  lineItems: LineItem[];
  chatOpen: boolean;          // Panel visibility
  chatMessages: ChatMessage[]; // Conversation history
}
```

## Key Implementation Details

### Image Handling
- First message includes diagram image (base64)
- Subsequent messages reuse context, no re-upload
- Supports local (`/uploads/`) and remote URLs

### Conversation Context
- Full history sent to Claude (excluding system acknowledgments)
- System messages starting with ✅/❌ filtered out
- Context includes current line items for accuracy

### Quick Replies
Automatically shown when assistant asks questions:
- Confirmation questions → "Yes, proceed" / "No, cancel"
- General questions → "Yes" / "No"

### Numbered Question Detection
When Claude asks multiple numbered questions (e.g., "1. What... 2. How..."):
- Auto-populates textarea with numbered template
- Focuses cursor at end of first line
- Makes multi-part answers easier

## Integration Pattern

1. User clicks chat icon in workspace
2. `WorkspaceView` renders `ChatPanel` in resizable panel
3. User sends message → `handleSendChatMessage` in `page.tsx`
4. API call to `/api/chat` with full context
5. Response updates `chatMessages` state
6. If `proposedChanges` exist, show accept/reject buttons
7. Accept → `handleAcceptChatChanges` applies changes to `lineItems`
8. Reject → `handleRejectChatChanges` adds rejection message

## Type Definitions

**Location**: `types/chat.ts`

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
  itemId?: string;
  newItem?: LineItem;
  changes?: FieldChange[];
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}
```

## Configuration

**Model**: `claude-sonnet-4-5-20250929`
**Max Tokens**: 4096
**Runtime**: Node.js (for file system access)
**Max Duration**: 60 seconds

## Error Handling

- Missing `ANTHROPIC_API_KEY` → 500 error
- Missing message → 400 error
- Image load failures → Continue without image
- JSON parse errors → Fall back to plain text response
- Network failures → Generic 500 error

## Future Enhancements

- Multi-turn confirmation dialogs
- Undo/redo for accepted changes
- Change preview before acceptance
- Voice input support
- Conversation export
