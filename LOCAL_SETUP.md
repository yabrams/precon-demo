# Local Development Setup Guide

This guide will help you get the project running locally for testing.

## Prerequisites

1. **Node.js 18+** - Check with `node --version`
2. **npm** - Comes with Node.js
3. **PostgreSQL** - Either:
   - Local PostgreSQL installation, OR
   - Vercel Postgres (for cloud database)
4. **Anthropic API Key** - Get from https://console.anthropic.com/

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /Users/barak/precon-demo
npm install
```

This will install all Node.js packages and automatically run `prisma generate` via the postinstall script.

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database Connection
# Option A: Local PostgreSQL
POSTGRES_PRISMA_URL="postgresql://username:password@localhost:5432/precon"
POSTGRES_URL_NON_POOLING="postgresql://username:password@localhost:5432/precon"

# Option B: Vercel Postgres (if using cloud database)
# POSTGRES_PRISMA_URL="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb?sslmode=require"
# POSTGRES_URL_NON_POOLING="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb?sslmode=require"

# Anthropic API Key (Required)
ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Vercel Blob Storage (Optional for local - can use file system)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_your-token-here"

# JWT Secret (for authentication)
JWT_SECRET="your-secret-key-change-in-production"
```

**Important**: Replace the placeholder values with your actual credentials.

### 3. Set Up Local PostgreSQL (if using local database)

If you don't have PostgreSQL installed:

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb precon
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb precon
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 4. Initialize Database Schema

```bash
npx prisma generate
npx prisma db push
```

This will:
- Generate Prisma Client
- Create all database tables based on the schema

### 5. (Optional) Seed Database

If you want sample data:

```bash
npx prisma db seed
```

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Local**: http://localhost:3000
- **Network**: http://[your-ip]:3000

## First-Time Usage

1. **Register an Account**
   - Open http://localhost:3000
   - Click "Register" or "Sign Up"
   - Create your first user account

2. **Create a Project**
   - After logging in, click "New Project"
   - Fill in project details
   - Upload construction diagrams (PDF or images)

3. **Extract Bid Data**
   - Select a project
   - Upload diagrams
   - AI will automatically categorize and extract bid line items

4. **Review and Edit**
   - Review extracted line items
   - Edit quantities, prices, descriptions
   - Use AI chat assistant for help

5. **Export**
   - Export bid forms as PDF, Excel, or CSV

## Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Database connection errors
- Verify PostgreSQL is running: `pg_isready` or `brew services list`
- Check connection string in `.env.local`
- Ensure database exists: `psql -l` should show your database

### Prisma errors
```bash
npx prisma generate
npx prisma db push
```

### Build errors
```bash
npm run build
```
Check the error output for specific issues.

### Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
PORT=3001 npm run dev
```

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio (database GUI)

# Linting
npm run lint             # Run ESLint
```

## Viewing Database

Use Prisma Studio to view and edit database records:

```bash
npm run db:studio
```

Opens at http://localhost:5555

## Testing the Application

### Test Workflow:
1. ✅ Register/Login
2. ✅ Create a new project
3. ✅ Upload a construction diagram (PDF or image)
4. ✅ AI categorizes the document
5. ✅ Confirm category and create bid package
6. ✅ AI extracts line items
7. ✅ Edit line items in the workspace
8. ✅ Use AI chat to modify items
9. ✅ Export as PDF/Excel/CSV

### Test API Endpoints:
- `GET /api/auth/me` - Check authentication
- `GET /api/projects` - List all projects
- `POST /api/upload` - Upload diagram
- `POST /api/extract-v2` - Extract bid data
- `POST /api/chat` - AI chat assistant

## Next Steps

Once running locally:
- Explore the project structure
- Test all features
- Review the codebase
- Make modifications as needed
- Deploy to Vercel when ready

## Getting Help

- Check `README.md` for general documentation
- Check `SETUP.md` for deployment setup
- Check `PROJECT_SUMMARY.md` for feature overview
- Review API route files in `app/api/` for endpoint documentation



