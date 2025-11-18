# Preconstruction Bidding App

An AI-powered web application for project engineers to convert construction diagrams into structured bid forms with automated data extraction and verification workflows.

## Features

- **Diagram Upload**: Drag-and-drop upload for construction diagrams (PDF, PNG, JPG)
- **AI-Powered Extraction**: Uses Claude 3.5 Sonnet vision API to extract bid line items from diagrams
- **Editable Bid Forms**: Interactive tables with automatic price calculations
- **Verification Workflow**: Split-screen view to compare diagrams with extracted data
- **Export Options**: Export to PDF, Excel, or CSV formats
- **Database Storage**: PostgreSQL database for projects, diagrams, and bid forms

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
│   │   └── extract/       # AI extraction endpoint
│   └── page.tsx           # Main application page
├── components/            # React components
│   ├── DiagramUpload.tsx  # File upload component
│   ├── BidFormTable.tsx   # Editable bid table
│   └── VerificationView.tsx # Split-screen verification
├── lib/                   # Utilities
│   ├── prisma.ts         # Prisma client
│   └── export.ts         # Export functions
├── prisma/               # Database schema
│   └── schema.prisma
├── api/                  # FastAPI backend
│   ├── main.py          # FastAPI app
│   └── requirements.txt
└── public/              # Static assets
```

## Workflow

1. **Upload**: Upload a construction diagram (PDF or image)
2. **Extract**: AI analyzes the diagram and extracts bid line items
3. **Edit**: Review and edit the extracted data in an interactive table
4. **Verify**: Compare the diagram side-by-side with the bid form, verify each item
5. **Export**: Download the final bid form as PDF, Excel, or CSV

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
