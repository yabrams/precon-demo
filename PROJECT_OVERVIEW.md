# Project Overview: Preconstruction Bidding Application

## What Is This Project?

This is a **full-stack AI-powered web application** designed for construction project engineers and preconstruction teams. It automates the process of converting construction diagrams (blueprints, plans, specifications) into structured bid forms with line items, quantities, and pricing.

Think of it as a **smart assistant for construction bidding** that:
- Reads construction documents (PDFs, images)
- Extracts relevant information using AI
- Organizes it into professional bid forms
- Helps you review, edit, and export the data

## Core Purpose

**Problem it solves**: Manually extracting line items from construction diagrams is time-consuming, error-prone, and tedious. Engineers spend hours copying data from PDFs into spreadsheets.

**Solution**: AI automatically analyzes diagrams, identifies construction elements (concrete, steel, MEP systems, etc.), extracts quantities and specifications, and organizes everything into editable bid forms.

## Key Features

### 1. **Project Management**
- Create and manage construction projects
- Link projects to external platforms (BuildingConnected, ConstructConnect, PlanHub)
- Organize projects with bid packages by trade/category
- Track project status and progress

### 2. **Document Upload & Processing**
- Upload construction diagrams (PDF, PNG, JPG, GIF, WebP)
- Automatic AI categorization by construction trade:
  - Structural Steel
  - Concrete
  - MEP (Mechanical, Electrical, Plumbing)
  - Site Work
  - Architectural Finishes
  - Specialty Items
  - General Requirements
- Document review interface with AI suggestions

### 3. **AI-Powered Data Extraction**
- Uses Claude 3.5 Sonnet Vision API to analyze diagrams
- Automatically extracts:
  - Line item numbers
  - Descriptions
  - Quantities and units
  - Pricing information
  - Notes and specifications
- Identifies CSI MasterFormat codes (construction industry standard)
- Creates multiple bid packages based on document content

### 4. **Interactive Bid Form Workspace**
- Editable table interface for line items
- Real-time calculations (quantity × unit price = total)
- Add, edit, or remove line items
- Visual linking between table rows and diagram locations
- Bounding box highlighting on diagrams
- Magnifying glass for detailed inspection
- Connection lines showing item locations

### 5. **AI Chat Assistant**
- Conversational interface to ask questions about diagrams
- Request modifications to bid forms
- Two-phase workflow: AI proposes changes, you approve/reject
- Context-aware responses based on current line items

### 6. **CSI MasterFormat Integration**
- Search construction industry codes (CSI MasterFormat)
- Browse hierarchical category tree
- AI-powered mapping of line items to CSI codes
- Floating widget for quick access

### 7. **Export & Sharing**
- Export bid forms in multiple formats:
  - **PDF**: Professional formatted documents
  - **Excel**: Spreadsheet with formulas
  - **CSV**: Simple data export
- Includes project name, date, line items, totals

### 8. **User Management & Authentication**
- User registration and login
- Role-based access control (RBAC):
  - **Admin**: Full system access
  - **Precon Lead**: Project management
  - **Scope Captain**: Bid package management
  - **Precon Analyst**: Data entry and review
- User assignment to projects/bid packages
- Admin panel for user management

### 9. **Database Persistence**
- PostgreSQL database with Prisma ORM
- Stores:
  - Users and authentication
  - Projects and bid packages
  - Diagrams and files
  - Bid forms and line items
  - Verification records
  - Chat conversation history

## Technology Stack

### Frontend
- **Next.js 16** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Table** - Data tables
- **Zustand** - State management (where needed)

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database access
- **PostgreSQL** - Relational database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

### AI & Processing
- **Anthropic Claude 3.5 Sonnet** - Vision API for document analysis
- **Vercel AI SDK** - AI integration
- **PDF.js** - PDF processing
- **Sharp** - Image processing

### Storage & Deployment
- **Vercel Blob Storage** - File storage
- **Vercel Postgres** - Cloud database (optional)
- **Vercel** - Hosting platform

## What Can You Do With It?

### For Project Engineers:
1. **Upload construction diagrams** from any source
2. **Let AI extract** all relevant line items automatically
3. **Review and edit** the extracted data in an intuitive interface
4. **Use AI chat** to ask questions or request modifications
5. **Export professional bid forms** for submission

### For Preconstruction Teams:
1. **Manage multiple projects** simultaneously
2. **Organize work by trade** (structural, MEP, etc.)
3. **Track progress** on bid packages
4. **Collaborate** with team members
5. **Maintain audit trail** of all changes

### For Administrators:
1. **Manage users** and permissions
2. **Assign team members** to projects
3. **Monitor system usage**
4. **Configure access controls**

## Typical Workflow

### 1. **Project Setup**
```
Create Project → Link External Project (optional) → Upload Documents
```

### 2. **Document Processing**
```
Upload Diagram → AI Categorizes → Review Category → Confirm → AI Extracts Line Items
```

### 3. **Bid Form Creation**
```
View Extracted Items → Edit Quantities/Prices → Add/Remove Items → Use AI Chat for Help
```

### 4. **Review & Verification**
```
Review Line Items → Verify Against Diagram → Submit for Review → Approve
```

### 5. **Export & Submission**
```
Export as PDF/Excel/CSV → Submit to Client → Track Status
```

## Project Structure

```
precon-demo/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── projects/        # Project management
│   │   ├── bid-packages/    # Bid package operations
│   │   ├── upload/          # File upload
│   │   ├── extract-v2/      # AI extraction
│   │   ├── chat/            # AI chat assistant
│   │   └── csi/             # CSI MasterFormat API
│   ├── admin/               # Admin pages
│   └── page.tsx             # Main application
├── components/              # React components
│   ├── admin/              # Admin components
│   ├── BidFormTable.tsx   # Editable bid table
│   ├── BidPackageWorkspace.tsx  # Main workspace
│   ├── ChatPanel.tsx      # AI chat interface
│   ├── DiagramUpload.tsx  # File upload
│   └── ...                 # Many more components
├── lib/                    # Utilities
│   ├── auth.ts            # Authentication helpers
│   ├── prisma.ts          # Database client
│   ├── export.ts          # Export functions
│   └── csi/               # CSI MasterFormat utilities
├── types/                  # TypeScript types
├── prisma/                 # Database schema
│   └── schema.prisma      # Database models
└── public/                 # Static assets
```

## Getting Started

### Quick Start:
1. **Install dependencies**: `npm install`
2. **Set up environment variables** (see `LOCAL_SETUP.md`)
3. **Initialize database**: `npx prisma db push`
4. **Start dev server**: `npm run dev`
5. **Open browser**: http://localhost:3000

### First Steps:
1. Register a new account
2. Create your first project
3. Upload a construction diagram
4. Watch AI extract the data
5. Review and export

## Key Concepts

### **Projects**
Top-level containers for construction work. Can be linked to external platforms.

### **Bid Packages**
Sub-divisions of projects by trade/category (e.g., "Structural Steel", "MEP"). Each package contains line items.

### **Line Items**
Individual bid entries with:
- Item number
- Description
- Quantity
- Unit (CY, SF, EA, etc.)
- Unit price
- Total price
- Notes

### **Diagrams**
Uploaded construction documents (PDFs, images) that are analyzed by AI.

### **CSI MasterFormat**
Industry-standard classification system for construction work. Used to categorize and organize line items.

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Session management
- Secure file uploads
- Input validation

## Performance Features

- Serverless API routes
- Database connection pooling
- Optimized image processing
- Lazy loading components
- Efficient data queries

## Future Enhancements (Potential)

- Real-time collaboration
- Mobile app
- Email notifications
- Advanced analytics
- Integration with accounting software
- Template management
- Historical bid comparisons

## Documentation Files

- `README.md` - General overview
- `LOCAL_SETUP.md` - Local development setup
- `SETUP.md` - Deployment setup
- `PROJECT_SUMMARY.md` - Technical details
- `DATABASE.md` - Database schema documentation
- `CHAT_SYSTEM.md` - AI chat system details
- `CSI_MODULE.md` - CSI MasterFormat integration
- `COMPONENTS_REFERENCE.md` - Component API reference

## Support & Resources

- Check documentation files in the project root
- Review API route files for endpoint documentation
- Use Prisma Studio to explore database: `npm run db:studio`
- Check browser console for debugging information

---

**Ready to get started?** Follow the `LOCAL_SETUP.md` guide to set up your local development environment!



