# Deployment Checklist

Use this checklist when deploying to Vercel for the first time.

## Pre-Deployment

- [ ] All code is committed to Git
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables documented in `.env.example`
- [ ] README.md is up to date
- [ ] .gitignore includes sensitive files

## Vercel Setup

### 1. Create Vercel Account
- [ ] Sign up at [vercel.com](https://vercel.com)
- [ ] Connect your GitHub/GitLab/Bitbucket account

### 2. Create New Project
- [ ] Click "New Project" in Vercel dashboard
- [ ] Import your Git repository
- [ ] Select framework preset: Next.js
- [ ] Configure project settings

### 3. Enable Storage Services

#### Vercel Postgres
- [ ] Go to Storage tab in your project
- [ ] Click "Create Database"
- [ ] Select "Postgres"
- [ ] Name your database
- [ ] Copy the connection strings:
  - `POSTGRES_PRISMA_URL`
  - `POSTGRES_URL_NON_POOLING`

#### Vercel Blob
- [ ] Go to Storage tab
- [ ] Click "Create Store"
- [ ] Select "Blob"
- [ ] Name your blob store
- [ ] Copy the token: `BLOB_READ_WRITE_TOKEN`

### 4. Configure Environment Variables
- [ ] Go to Settings → Environment Variables
- [ ] Add the following:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your-token-here
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

- [ ] Set environment: Production, Preview, Development (check all)
- [ ] Save changes

### 5. Deploy
- [ ] Click "Deploy" button
- [ ] Wait for build to complete
- [ ] Check deployment logs for errors

## Post-Deployment

### 1. Initialize Database
- [ ] Open Vercel CLI or use the Vercel dashboard
- [ ] Run Prisma migration:
  ```bash
  npx prisma db push
  ```

### 2. Test the Application
- [ ] Visit your deployed URL
- [ ] Test diagram upload
- [ ] Test AI extraction
- [ ] Test bid form editing
- [ ] Test verification workflow
- [ ] Test export functionality (PDF, Excel, CSV)

### 3. Monitor
- [ ] Check Vercel Analytics for traffic
- [ ] Monitor function logs for errors
- [ ] Check database usage
- [ ] Check blob storage usage

## Environment Variables Quick Reference

| Variable | Where to Get It | Required |
|----------|----------------|----------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Dashboard → Storage → Blob | Yes |
| `POSTGRES_PRISMA_URL` | Vercel Dashboard → Storage → Postgres | Yes |
| `POSTGRES_URL_NON_POOLING` | Vercel Dashboard → Storage → Postgres | Yes |

## Troubleshooting

### Build Fails
- [ ] Check build logs in Vercel dashboard
- [ ] Verify all dependencies are in package.json
- [ ] Run `npm run build` locally first
- [ ] Check for TypeScript errors

### Database Connection Errors
- [ ] Verify Postgres connection strings are correct
- [ ] Check database is created and accessible
- [ ] Run `npx prisma generate` in build settings

### API Errors
- [ ] Verify ANTHROPIC_API_KEY is set correctly
- [ ] Check API key has credits/quota
- [ ] Check API endpoint logs in Vercel

### Upload Errors
- [ ] Verify BLOB_READ_WRITE_TOKEN is set
- [ ] Check blob store is created
- [ ] Verify file size limits

## Optional: Custom Domain

- [ ] Go to Settings → Domains
- [ ] Add your custom domain
- [ ] Update DNS records as instructed
- [ ] Wait for SSL certificate to provision
- [ ] Test domain access

## Security Checklist

- [ ] All API keys are in environment variables (not in code)
- [ ] .env files are in .gitignore
- [ ] CORS is properly configured
- [ ] Input validation is implemented
- [ ] File upload limits are set

## Performance Optimization

- [ ] Enable Analytics in Vercel dashboard
- [ ] Monitor Core Web Vitals
- [ ] Check function execution times
- [ ] Optimize image sizes if needed
- [ ] Review bundle size

## Backup & Recovery

- [ ] Document database backup strategy
- [ ] Export sample data for testing
- [ ] Document rollback procedure
- [ ] Keep local development environment synced

## Success Criteria

✅ Application is accessible at deployed URL
✅ Can upload diagrams successfully
✅ AI extraction works correctly
✅ Database operations succeed
✅ Export functions work (PDF, Excel, CSV)
✅ No errors in function logs
✅ Performance is acceptable (<3s load time)

## Next Steps After Deployment

1. Share URL with team for testing
2. Gather user feedback
3. Monitor usage and errors
4. Plan feature enhancements
5. Set up monitoring alerts
6. Configure automated backups

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)

---

**Deployment Date**: _____________

**Deployed URL**: _____________

**Deployed By**: _____________
