# Preconstruction Bidding App

An AI-powered web application for project engineers to convert construction diagrams into structured bid forms with automated data extraction and verification workflows.

## Features

### Core Workflow
- **Inbox-First Landing Page**: Email-like interface for managing diagram submissions with status tracking
- **Diagram Upload**: Drag-and-drop upload for construction diagrams (PDF, PNG, JPG)
- **AI-Powered Extraction**: Uses Claude Sonnet 4.5 Vision API to extract bid line items with bounding boxes
- **Editable Bid Forms**: Interactive tables with automatic price calculations and inline editing

### AI Assistant
- **Conversational Chat**: Ask questions about diagrams or request bid form updates
- **Two-Phase Workflow**: Confirmation dialog before applying changes to line items
- **Smart Detection**: Distinguishes between questions and update requests automatically

### Visual Features
- **Bounding Box Highlighting**: Visual indicators showing where line items appear on diagrams
- **Interactive Linking**: Hover over table rows to highlight diagram regions (and vice versa)
- **Magnifying Glass**: Zoom lens that follows mouse for detailed diagram inspection
- **Connection Lines**: Animated curves linking table rows to their diagram locations

### Export & Management
- **Multi-Format Export**: Export to PDF, Excel, or CSV with project names
- **Project Tabs**: Manage multiple projects simultaneously with tabbed interface
- **Database Storage**: PostgreSQL schema ready for persistence (currently in-memory state)

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python) for AI processing endpoints
- **AI**: Vercel AI SDK + Claude 3.5 Sonnet (Anthropic)
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: Vercel Blob Storage for diagram files
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL database (or Vercel Postgres)
- Anthropic API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd precon
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
cd api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

4. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:
```env
# Database
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# Anthropic API
ANTHROPIC_API_KEY="sk-ant-..."

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
```

Also create `api/.env`:
```env
ANTHROPIC_API_KEY="sk-ant-..."
```

5. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

### Development

Run the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

For local FastAPI testing (optional):
```bash
cd api
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

## Project Structure

```
precon/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── upload/        # File upload endpoint
│   │   ├── extract/       # AI extraction endpoint
│   │   └── chat/          # AI chat assistant endpoint (NEW)
│   └── page.tsx           # Main application page (state management)
├── components/            # React components
│   ├── InboxListView.tsx  # Inbox landing page (NEW)
│   ├── InboxCard.tsx      # Inbox item cards (NEW)
│   ├── DiagramUpload.tsx  # File upload component
│   ├── BidFormTable.tsx   # Editable bid table
│   ├── WorkspaceView.tsx  # Main workspace with panels
│   ├── ChatPanel.tsx      # AI chat interface (NEW)
│   ├── ChatMessage.tsx    # Chat message component (NEW)
│   ├── DiagramOverlay.tsx # Bounding box overlay (NEW)
│   ├── MagnifyingGlass.tsx # Zoom lens (NEW)
│   └── ConnectionLine.tsx # Visual linking (NEW)
├── types/                 # TypeScript type definitions
│   ├── inbox.ts          # Inbox types (NEW)
│   └── chat.ts           # Chat types (NEW)
├── lib/                   # Utilities
│   ├── prisma.ts         # Prisma client
│   ├── export.ts         # Export functions (PDF/Excel/CSV)
│   ├── mockInboxData.ts  # Mock inbox data (NEW)
│   └── cokeExtractionData.json # Sample extracted data (NEW)
├── prisma/               # Database schema
│   └── schema.prisma
├── scripts/              # Utility scripts (NEW)
│   └── processCokeImage.ts
└── public/              # Static assets
    └── uploads/         # Uploaded diagram files
```

## Workflow

1. **Inbox**: View all diagram submissions on landing page with status tracking
2. **Upload**: Click "New Diagram" to upload a construction diagram (PDF or image)
3. **Extract**: AI analyzes the diagram and extracts bid line items with bounding boxes
4. **Review**: Interactive workspace with resizable panels showing diagram and bid table
5. **Chat**: Use AI assistant to ask questions or request bid form modifications
6. **Visual**: Hover over table rows to see highlighted regions on the diagram
7. **Edit**: Make manual edits to line items with automatic calculations
8. **Export**: Download the final bid form as PDF, Excel, or CSV

## Documentation

For detailed feature documentation:
- **INBOX_WORKFLOW.md**: Inbox system and navigation patterns
- **CHAT_SYSTEM.md**: AI chat assistant and conversation workflow
- **VISUAL_FEATURES.md**: Bounding boxes, magnifying glass, connection lines
- **COMPONENTS_REFERENCE.md**: Complete component API reference
- **CLAUDE.md**: Claude Code-specific guidance and architecture overview

## Database Schema

- **Projects**: Container for related diagrams and bid forms
- **Diagrams**: Uploaded diagram files with metadata
- **BidForms**: Extracted and edited bid forms
- **LineItems**: Individual line items in bid forms
- **VerificationRecords**: Verification history and comments

## Deploy to Vercel

1. Push your code to GitHub

2. Import the project in Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository

3. Configure environment variables in Vercel:
   - Add `ANTHROPIC_API_KEY`
   - Add `BLOB_READ_WRITE_TOKEN` (auto-generated when you enable Blob Storage)
   - Add `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` (auto-generated when you enable Vercel Postgres)

4. Enable Vercel integrations:
   - Vercel Postgres (Storage tab)
   - Vercel Blob (Storage tab)

5. Deploy!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage token | Yes |
| `POSTGRES_PRISMA_URL` | PostgreSQL connection URL (pooled) | Yes |
| `POSTGRES_URL_NON_POOLING` | PostgreSQL direct connection URL | Yes |

## API Endpoints

### Next.js API Routes

- `POST /api/upload` - Upload diagram to Vercel Blob Storage
- `POST /api/extract` - Extract bid data from diagram using Claude Vision

### FastAPI Endpoints (Optional)

- `POST /api/extract-bid` - Alternative extraction endpoint using FastAPI
- `GET /health` - Health check

## License

MIT
