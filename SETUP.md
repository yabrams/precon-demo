# Setup Guide

## Quick Start

Follow these steps to get your preconstruction bidding app running:

### 1. Environment Variables

You need to set up three API keys/tokens:

#### A. Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

#### B. Vercel Postgres Database
1. Go to [vercel.com](https://vercel.com/)
2. Create a new project or use existing
3. Go to Storage tab
4. Click "Create Database" → Select "Postgres"
5. Copy the connection strings provided

#### C. Vercel Blob Storage
1. In your Vercel project, go to Storage tab
2. Click "Create Database" → Select "Blob"
3. Copy the `BLOB_READ_WRITE_TOKEN` provided

### 2. Configure Environment Variables

Edit `.env.local` file:

```env
# Database - Get from Vercel Postgres
POSTGRES_PRISMA_URL="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb?sslmode=require"
POSTGRES_URL_NON_POOLING="postgres://default:xxx@xxx.vercel-storage.com:5432/verceldb?sslmode=require"

# Anthropic API
ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_your-token-here"
```

Also edit `api/.env`:

```env
ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

### 3. Initialize Database

Run Prisma to set up your database schema:

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Test the Application

1. Upload a construction diagram (PDF or image)
2. Click "Extract Bid Form Data"
3. Review and edit the extracted line items
4. Proceed to verification
5. Verify all items and approve
6. Export as PDF, Excel, or CSV

## Troubleshooting

### Build Errors

If you encounter module not found errors:
```bash
npm install
npx prisma generate
```

### Database Connection Issues

Make sure your Postgres connection strings are correct and the database is accessible.

### API Key Issues

Verify that:
- `ANTHROPIC_API_KEY` is set in both `.env.local` and `api/.env`
- The key starts with `sk-ant-`
- You have API credits in your Anthropic account

### Blob Storage Issues

Make sure `BLOB_READ_WRITE_TOKEN` is set in `.env.local` and starts with `vercel_blob_rw_`

## Deployment to Vercel

### Method 1: Via GitHub

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Enable Vercel Postgres and Blob Storage
6. Deploy

### Method 2: Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Follow the prompts to deploy.

### Post-Deployment

After deployment:
1. Go to your Vercel project dashboard
2. Navigate to Storage tab
3. Create Postgres database (copy connection strings to env vars)
4. Create Blob storage (copy token to env vars)
5. Add `ANTHROPIC_API_KEY` to environment variables
6. Redeploy if needed

## Next Steps

- Add user authentication (Clerk, NextAuth, etc.)
- Implement project management features
- Add email notifications
- Create admin dashboard
- Add team collaboration features
