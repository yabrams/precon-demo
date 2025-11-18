# Database Setup and Management

## Local PostgreSQL Setup (Completed ✅)

PostgreSQL 16 has been installed and configured for local development.

### Database Information

- **Database Name**: `precon`
- **Host**: `localhost`
- **Port**: `5432`
- **User**: `yaron.abramas` (your system user)
- **Connection String**: `postgresql://yaron.abramas@localhost:5432/precon`

### Tables Created

- `Project` - Container for related diagrams and bid forms
- `Diagram` - Uploaded diagram files and metadata
- `BidForm` - Extracted and edited bid forms
- `LineItem` - Individual line items in bid forms
- `VerificationRecord` - Verification history and approvals

## Database Commands

### Start/Stop PostgreSQL

```bash
# Start PostgreSQL
brew services start postgresql@16

# Stop PostgreSQL
brew services stop postgresql@16

# Restart PostgreSQL
brew services restart postgresql@16

# Check status
brew services list | grep postgresql
```

### Prisma Commands

```bash
# Generate Prisma Client
npm run db:generate
# or
npx prisma generate

# Push schema changes to database
npm run db:push
# or
npx prisma db push

# Open Prisma Studio (GUI for database)
npm run db:studio
# or
npx prisma studio
```

### Direct PostgreSQL Access

```bash
# Connect to database
/opt/homebrew/opt/postgresql@16/bin/psql -d precon

# List all tables
/opt/homebrew/opt/postgresql@16/bin/psql -d precon -c "\dt"

# View table structure
/opt/homebrew/opt/postgresql@16/bin/psql -d precon -c "\d Project"

# Query data
/opt/homebrew/opt/postgresql@16/bin/psql -d precon -c "SELECT * FROM \"Project\";"

# Drop and recreate database (⚠️ destroys all data)
/opt/homebrew/opt/postgresql@16/bin/dropdb precon
/opt/homebrew/opt/postgresql@16/bin/createdb precon
npx prisma db push
```

## Prisma Studio

Launch Prisma Studio to visually browse and edit your database:

```bash
npm run db:studio
```

This opens a web interface at http://localhost:5555 where you can:
- Browse all tables
- View records
- Add/edit/delete data
- Run queries

## Database Backup

### Create backup

```bash
/opt/homebrew/opt/postgresql@16/bin/pg_dump precon > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore backup

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d precon < backup_20250112_143000.sql
```

## Schema Changes

When you modify `prisma/schema.prisma`:

1. Push changes to database:
   ```bash
   npm run db:push
   ```

2. Generate updated Prisma Client:
   ```bash
   npm run db:generate
   ```

## Troubleshooting

### Database connection errors

1. Check if PostgreSQL is running:
   ```bash
   brew services list | grep postgresql
   ```

2. Verify database exists:
   ```bash
   /opt/homebrew/opt/postgresql@16/bin/psql -l
   ```

3. Check connection string in `.env`:
   ```
   POSTGRES_PRISMA_URL="postgresql://yaron.abramas@localhost:5432/precon"
   ```

### Reset database

⚠️ This will delete all data:

```bash
npx prisma db push --force-reset
```

### Check logs

```bash
tail -f /opt/homebrew/var/log/postgresql@16.log
```

## Production Database (Vercel Postgres)

When deploying to Vercel:

1. Enable Vercel Postgres in your project
2. Copy connection strings to Vercel environment variables
3. Run migration:
   ```bash
   npx prisma db push
   ```

Connection strings will be different:
```
POSTGRES_PRISMA_URL="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb"
POSTGRES_URL_NON_POOLING="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb"
```

## Useful Queries

```sql
-- Count projects
SELECT COUNT(*) FROM "Project";

-- List recent diagrams with project names
SELECT d.id, d."fileName", p.name as project_name, d."uploadedAt"
FROM "Diagram" d
JOIN "Project" p ON d."projectId" = p.id
ORDER BY d."uploadedAt" DESC;

-- View bid forms with line item counts
SELECT bf.id, p.name, COUNT(li.id) as line_item_count, bf.status
FROM "BidForm" bf
JOIN "Project" p ON bf."projectId" = p.id
LEFT JOIN "LineItem" li ON li."bidFormId" = bf.id
GROUP BY bf.id, p.name, bf.status;

-- Calculate total bid amounts
SELECT bf.id, SUM(li."totalPrice") as total_amount
FROM "BidForm" bf
JOIN "LineItem" li ON li."bidFormId" = bf.id
GROUP BY bf.id;
```

## Environment Variables

Your `.env` file should contain:

```env
POSTGRES_PRISMA_URL="postgresql://yaron.abramas@localhost:5432/precon"
POSTGRES_URL_NON_POOLING="postgresql://yaron.abramas@localhost:5432/precon"
ANTHROPIC_API_KEY="sk-ant-your-key-here"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_your-token-here"
```

Never commit `.env` files - they are in `.gitignore`.
