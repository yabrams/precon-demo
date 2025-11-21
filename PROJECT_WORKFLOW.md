# Project Workflow Documentation

This document describes how projects, documents, bid packages, and bid forms are managed throughout the application lifecycle.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema & Relationships](#database-schema--relationships)
3. [Project Creation](#project-creation)
4. [Document Upload Workflow](#document-upload-workflow)
5. [AI Extraction & Categorization](#ai-extraction--categorization)
6. [Bid Package Management](#bid-package-management)
7. [Bid Form Management](#bid-form-management)
8. [State Management](#state-management)
9. [API Reference](#api-reference)

---

## Architecture Overview

The application follows a **database-first architecture** where all data is persisted to PostgreSQL via Prisma ORM. The workflow progresses through these stages:

```
BuildingConnected Project
    ↓
Document Upload
    ↓
AI Categorization (Claude Vision)
    ↓
Bid Package Creation
    ↓
Bid Form Generation
    ↓
Line Item Extraction (Claude Vision)
    ↓
User Review & Editing
```

### Key Components

- **BuildingConnected Projects**: Container for all project metadata and diagrams
- **Diagrams**: Uploaded construction documents (PDFs, images)
- **Bid Packages**: Categorized groupings of work (e.g., "Structural Steel", "MEP")
- **Bid Forms**: Individual forms within a bid package, linked to specific diagrams
- **Line Items**: Extracted bid items with quantities, units, and pricing

---

## Database Schema & Relationships

### Entity Relationship Diagram

```
BuildingConnectedProject (1) ──── (many) Diagram
BuildingConnectedProject (1) ──── (many) BidPackage
         BidPackage (1) ──── (many) BidForm
            BidForm (1) ──── (many) LineItem
            BidForm (many) ──── (1) Diagram
```

### Prisma Models

#### BuildingConnectedProject

```prisma
model BuildingConnectedProject {
  id              String       @id @default(cuid())
  bcProjectId     String       @unique  // External BuildingConnected ID
  name            String
  projectNumber   String?
  description     String?
  status          String       @default("active")
  projectValue    Float?
  projectSize     Float?
  projectSizeUnit String?
  location        Json?        // { city, state, country }
  client          String?
  accountManager  String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  diagrams        Diagram[]
  bidPackages     BidPackage[]
}
```

**Key Fields**:
- `bcProjectId`: Unique identifier from BuildingConnected system
- `status`: `"active"` | `"archived"` | `"completed"`
- `location`: JSON object with `{ city, state, country }`

#### Diagram

```prisma
model Diagram {
  id          String    @id @default(cuid())
  fileName    String
  fileUrl     String    // Path to uploaded file
  fileType    String    // MIME type
  fileSize    Int       // Bytes
  category    String?   // AI-suggested category

  // Relations
  projectId   String
  project     BuildingConnectedProject @relation(...)
  bidForms    BidForm[]
}
```

**Key Fields**:
- `fileUrl`: Stored as `/uploads/[timestamp]-[filename]`
- `category`: Populated after AI categorization (e.g., "STRUCTURAL STEEL")

#### BidPackage

```prisma
model BidPackage {
  id          String     @id @default(cuid())
  name        String
  description String?
  scope       String?
  bidDueDate  DateTime?
  status      String     @default("draft")
  progress    Int        @default(0)
  diagramIds  String?    // JSON array of diagram IDs

  // Relations
  projectId   String
  project     BuildingConnectedProject @relation(...)
  bidForms    BidForm[]
}
```

**Key Fields**:
- `status`: `"draft"` | `"active"` | `"bidding"` | `"awarded"` | `"closed"`
- `progress`: 0-100 percentage
- `diagramIds`: JSON-stringified array for multi-diagram support

#### BidForm

```prisma
model BidForm {
  id              String     @id @default(cuid())
  name            String
  description     String?
  status          String     @default("draft")

  // Relations
  bidPackageId    String
  bidPackage      BidPackage @relation(...)
  diagramId       String?
  diagram         Diagram?   @relation(...)
  lineItems       LineItem[]
}
```

**Key Fields**:
- `status`: `"draft"` | `"in_progress"` | `"completed"` | `"verified"`
- Links a diagram to a bid package for extraction

#### LineItem

```prisma
model LineItem {
  id          String   @id @default(cuid())
  itemNumber  String?
  description String
  quantity    Float?
  unit        String?
  unitPrice   Float?
  totalPrice  Float?
  notes       String?
  verified    Boolean  @default(false)
  boundingBox Json?    // { x, y, width, height }
  order       Int      @default(0)

  // Relations
  bidFormId   String
  bidForm     BidForm  @relation(...)
}
```

**Key Fields**:
- `boundingBox`: Normalized coordinates (0-1) for visual linking
- `order`: Display order in the table
- `verified`: User confirmation flag

---

## Project Creation

### Method 1: Seed Script (Development)

Use the provided seed script to create mock projects:

```bash
npx tsx scripts/seed-project.ts
```

This creates a fully-populated BuildingConnected project with:
- Project metadata (name, location, client)
- Empty diagrams array (ready for uploads)

**Script Location**: `scripts/seed-project.ts`

### Method 2: API Creation

```typescript
// POST /api/projects
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bcProjectId: 'BC-2025-001',
    name: 'Downtown Office Tower',
    projectNumber: 'DOT-2025-001',
    description: 'New 15-story Class A office building',
    status: 'active',
    projectValue: 25000000,
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'USA'
    },
    client: 'Acme Development Corp',
    accountManager: 'John Smith'
  })
});

const { project } = await response.json();
```

### Method 3: BuildingConnected Integration (Future)

*Not yet implemented - infrastructure ready*

Projects will sync automatically from BuildingConnected API with webhooks.

---

## Document Upload Workflow

### User Flow

```
User clicks "Upload Diagram" button
    ↓
File picker opens (accepts: image/*, .pdf)
    ↓
File selected
    ↓
Upload to /api/upload
    ↓
File saved to /public/uploads/
    ↓
Diagram record created in database
    ↓
View switches to "reviewing" mode
    ↓
AI categorization begins
```

### Implementation

**Component**: `BidPackageListView.tsx`

```typescript
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('bcProjectId', project.id); // Critical: associate with project

  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadedData = await uploadResponse.json();
  // { url, fileName, fileSize, fileType, diagram }

  if (onUploadSuccess) {
    onUploadSuccess(uploadedData);
  }
};
```

### Upload API Flow

**Endpoint**: `POST /api/upload`

```typescript
// 1. Receive file and bcProjectId
const formData = await request.formData();
const file = formData.get('file') as File;
const bcProjectId = formData.get('bcProjectId') as string;

// 2. Save to filesystem
const buffer = Buffer.from(await file.arrayBuffer());
const filename = `${Date.now()}-${file.name}`;
const filepath = path.join(process.cwd(), 'public/uploads', filename);
await writeFile(filepath, buffer);

// 3. Create diagram record in database
const diagram = await prisma.diagram.create({
  data: {
    fileName: file.name,
    fileUrl: `/uploads/${filename}`,
    fileType: file.type,
    fileSize: file.size,
    projectId: bcProjectId
  }
});

// 4. Return diagram data
return NextResponse.json({
  url: `/uploads/${filename}`,
  fileName: file.name,
  fileSize: file.size,
  fileType: file.type,
  diagram
});
```

**Storage Location**: `/public/uploads/[timestamp]-[filename]`

---

## AI Extraction & Categorization

### Two-Phase AI Process

#### Phase 1: Document Categorization (Immediate)

After upload, Claude Vision analyzes the document to suggest a bid package category.

**Endpoint**: `POST /api/ai/categorize-document`

```typescript
const response = await fetch('/api/ai/categorize-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: diagram.fileUrl,
    fileName: diagram.fileName,
    fileType: diagram.fileType
  })
});

const categorization = await response.json();
// {
//   category: "STRUCTURAL STEEL",
//   confidence: 0.92,
//   reasoning: "Document shows steel beam details...",
//   alternativeCategories: ["MEP", "ARCHITECTURAL FINISHES"]
// }
```

**Available Categories**:
1. `STRUCTURAL STEEL` - Steel framing, beams, columns
2. `CONCRETE` - Concrete work, formwork, reinforcement
3. `MEP` - Mechanical, Electrical, Plumbing systems
4. `SITE WORK` - Excavation, grading, utilities
5. `ARCHITECTURAL FINISHES` - Drywall, painting, flooring
6. `SPECIALTY ITEMS` - Elevators, special equipment
7. `GENERAL REQUIREMENTS` - Safety, temporary facilities

**Confidence Levels**:
- `0.9-1.0`: Very High - Clear indicators
- `0.7-0.9`: High - Supporting evidence
- `0.5-0.7`: Moderate - Could fit multiple categories
- `0.0-0.5`: Low - Ambiguous document

**User Review**:
User sees `DocumentReviewView` component with:
- Left panel: Document preview
- Right panel: AI suggestion with confidence + alternative categories
- User can confirm or select different category

#### Phase 2: Line Item Extraction (After Confirmation)

Once user confirms the category and creates the bid package, line items are extracted.

**Endpoint**: `POST /api/extract`

```typescript
const response = await fetch('/api/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: diagram.fileUrl,
    bidPackageId: newBidPackage.id
  })
});

const extractedData = await response.json();
// {
//   project_name: "Steel Framing - Level 3",
//   line_items: [
//     {
//       item_number: "1",
//       description: "W12x26 Steel Beam",
//       quantity: 45,
//       unit: "LF",
//       unit_price: null,
//       total_price: null,
//       boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.05 }
//     }
//   ]
// }
```

**Extraction Process**:

1. Read image file (local or remote)
2. Convert to base64
3. Send to Claude Sonnet 4.5 Vision API with structured prompt
4. Parse JSON response (handles markdown code blocks)
5. Create bid form and line items in database
6. Return extracted data

**AI Prompt Structure**:
```
You are a construction estimator analyzing a bid document.
Extract ALL line items with:
- Item number
- Description
- Quantity
- Unit (LF, SF, EA, CY, etc.)
- Unit price (if visible)
- Total price (if visible)

Return JSON: { project_name: "...", line_items: [...] }
```

---

## Bid Package Management

### Creating a Bid Package

Bid packages are created after user confirms document categorization.

**Flow**:
```
User uploads diagram
    ↓
AI suggests category (e.g., "STRUCTURAL STEEL")
    ↓
User reviews and confirms category
    ↓
Bid package created with selected category
    ↓
Bid form created linking diagram to package
    ↓
Line items extracted and saved to bid form
```

**Implementation**: `app/page.tsx`

```typescript
const handleCategoryConfirm = async (selectedCategory: string) => {
  if (!pendingDiagram) return;

  setIsProcessingCategory(true);

  try {
    // 1. Create bid package
    const packageResponse = await fetch('/api/bid-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${selectedCategory} - ${pendingDiagram.fileName}`,
        description: `Bid package for ${selectedCategory}`,
        status: 'active',
        progress: 0,
        projectId: selectedProject?.id,
        diagramIds: [pendingDiagram.id]
      })
    });

    const { bidPackage } = await packageResponse.json();

    // 2. Create bid form linking diagram to package
    const formResponse = await fetch('/api/bid-forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pendingDiagram.fileName,
        bidPackageId: bidPackage.id,
        diagramId: pendingDiagram.id
      })
    });

    // 3. Extract line items
    const extractResponse = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: pendingDiagram.fileUrl,
        bidPackageId: bidPackage.id
      })
    });

    // 4. Update diagram with category
    await fetch(`/api/diagrams/${pendingDiagram.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: selectedCategory
      })
    });

    // 5. Switch to workspace view
    setViewMode('workspace');
  } catch (error) {
    console.error('Error creating bid package:', error);
  }
};
```

### Bid Package Structure

```typescript
interface BidPackage {
  id: string;
  name: string;                    // "STRUCTURAL STEEL - floor-plan.pdf"
  description?: string;
  scope?: string;
  bidDueDate?: Date;
  status: 'draft' | 'active' | 'bidding' | 'awarded' | 'closed';
  progress: number;                // 0-100
  diagramIds?: string[];           // JSON array of diagram IDs
  projectId: string;

  // Relations (loaded via Prisma include)
  project?: BuildingConnectedProject;
  bidForms?: BidForm[];
}
```

### Updating a Bid Package

**Endpoint**: `PUT /api/bid-packages/[id]`

```typescript
await fetch(`/api/bid-packages/${bidPackage.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Updated Package Name',
    description: 'New description',
    status: 'bidding',
    progress: 50,
    bidDueDate: '2025-12-31T00:00:00Z'
  })
});
```

### Deleting a Bid Package

**Endpoint**: `DELETE /api/bid-packages/[id]`

Cascades to delete:
- All bid forms in the package
- All line items in those bid forms

```typescript
await fetch(`/api/bid-packages/${bidPackage.id}`, {
  method: 'DELETE'
});
```

---

## Bid Form Management

### Bid Form Lifecycle

```
Bid Form Created (when bid package is created)
    ↓
Status: "draft"
    ↓
Line Items Extracted (via /api/extract)
    ↓
Status: "in_progress" (user editing)
    ↓
User Verifies All Items
    ↓
Status: "completed"
    ↓
Admin Review
    ↓
Status: "verified"
```

### Creating a Bid Form

**Endpoint**: `POST /api/bid-forms`

```typescript
const response = await fetch('/api/bid-forms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Steel Framing - Level 3',
    description: 'Steel beam and column schedule',
    status: 'draft',
    bidPackageId: bidPackage.id,
    diagramId: diagram.id
  })
});

const { bidForm } = await response.json();
```

### Loading a Bid Form with Line Items

**Endpoint**: `GET /api/bid-forms/[id]`

```typescript
const response = await fetch(`/api/bid-forms/${bidFormId}`);
const { bidForm } = await response.json();

// bidForm includes:
// - bidForm.lineItems[] (ordered by lineItem.order)
// - bidForm.diagram (file metadata)
// - bidForm.bidPackage (parent package)
```

**Prisma Query**:
```typescript
const bidForm = await prisma.bidForm.findUnique({
  where: { id },
  include: {
    diagram: true,
    bidPackage: true,
    lineItems: {
      orderBy: { order: 'asc' }
    }
  }
});
```

### Updating Line Items

Line items are updated individually:

**Endpoint**: `PUT /api/bid-forms/[id]/line-items/[lineItemId]`

```typescript
await fetch(`/api/bid-forms/${bidFormId}/line-items/${lineItemId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quantity: 50,
    unit: 'LF',
    unit_price: 25.50,
    total_price: 1275.00,
    verified: true
  })
});
```

**Auto-calculation**: `total_price = quantity × unit_price` happens in `BidFormTable.tsx`

### Adding Line Items

Users can add new line items manually:

```typescript
await fetch(`/api/bid-forms/${bidFormId}/line-items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: 'Additional steel beam',
    quantity: 10,
    unit: 'LF',
    order: existingItems.length // Append to end
  })
});
```

### Deleting Line Items

```typescript
await fetch(`/api/bid-forms/${bidFormId}/line-items/${lineItemId}`, {
  method: 'DELETE'
});
```

---

## State Management

### View Modes

The application uses a single-page architecture with mode-based rendering:

```typescript
type ViewMode = 'inbox' | 'upload' | 'reviewing' | 'workspace';
```

**State Location**: `app/page.tsx`

#### Inbox Mode (Default)

Shows list of all BuildingConnected projects with their bid packages.

```typescript
const [viewMode, setViewMode] = useState<ViewMode>('inbox');
const [projects, setProjects] = useState<BuildingConnectedProject[]>([]);
```

#### Upload Mode

Triggered by "Upload Diagram" button. Shows `DiagramUpload` component.

```typescript
const handleUploadClick = () => {
  setViewMode('upload');
};
```

#### Reviewing Mode

Triggered immediately after upload. Shows `DocumentReviewView` with AI categorization.

```typescript
const handleUploadSuccess = async (uploadResult: any) => {
  setPendingDiagram(uploadResult.diagram);
  setViewMode('reviewing');
  setIsCategorizingDocument(true);

  // Start AI categorization in background
  const categorization = await fetch('/api/ai/categorize-document', ...);
  setCategorization(categorization);
  setIsCategorizingDocument(false);
};
```

#### Workspace Mode

Shows split-panel workspace with diagram viewer and bid form table.

```typescript
const handleBidPackageSelect = async (bidPackage: BidPackage) => {
  // Load line items from database
  const allLineItems = bidPackage.bidForms?.flatMap(bf =>
    bf.lineItems?.map(li => ({
      id: li.id,
      item_number: li.itemNumber,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unitPrice,
      total_price: li.totalPrice,
      notes: li.notes,
      verified: li.verified
    })) || []
  ) || [];

  setSelectedBidPackage({
    ...bidPackage,
    lineItems: allLineItems,
    chatMessages: [],
    chatOpen: false
  });

  setViewMode('workspace');
};
```

### Data Loading Pattern

#### On Page Load

```typescript
useEffect(() => {
  const fetchProjects = async () => {
    const response = await fetch('/api/projects');
    const data = await response.json();
    setProjects(data.projects);
  };

  fetchProjects();
}, []);
```

#### Loading Bid Packages for a Project

```typescript
const fetchBidPackages = async (projectId: string) => {
  const response = await fetch(`/api/bid-packages?projectId=${projectId}`);
  const data = await response.json();
  return data.bidPackages;
};
```

#### Loading Full Bid Package (with line items)

```typescript
const response = await fetch(`/api/bid-packages/${bidPackageId}`);
const { bidPackage } = await response.json();

// bidPackage includes:
// - bidPackage.bidForms[].lineItems[] (fully populated)
// - bidPackage.project (BuildingConnected project)
```

---

## API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all BuildingConnected projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/[id]` | Get project with diagrams and bid packages |
| PUT | `/api/projects/[id]` | Update project metadata |
| DELETE | `/api/projects/[id]` | Delete project (cascades) |

### Diagrams

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload diagram file |
| GET | `/api/diagrams` | List diagrams (filter by projectId) |
| GET | `/api/diagrams/[id]` | Get diagram metadata |
| PUT | `/api/diagrams/[id]` | Update diagram (e.g., set category) |
| DELETE | `/api/diagrams/[id]` | Delete diagram file and record |

### Bid Packages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bid-packages` | List bid packages (filter by projectId) |
| POST | `/api/bid-packages` | Create new bid package |
| GET | `/api/bid-packages/[id]` | Get bid package with forms and line items |
| PUT | `/api/bid-packages/[id]` | Update bid package |
| DELETE | `/api/bid-packages/[id]` | Delete bid package (cascades) |

### Bid Forms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bid-forms` | List bid forms (filter by bidPackageId) |
| POST | `/api/bid-forms` | Create new bid form |
| GET | `/api/bid-forms/[id]` | Get bid form with line items |
| PUT | `/api/bid-forms/[id]` | Update bid form |
| DELETE | `/api/bid-forms/[id]` | Delete bid form (cascades) |

### AI Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/categorize-document` | Categorize document into bid package type |
| POST | `/api/extract` | Extract line items from diagram |

---

## Complete Workflow Example

### End-to-End: Upload → Extract → Edit

```typescript
// 1. User selects a BuildingConnected project
const project = projects.find(p => p.id === selectedProjectId);

// 2. User uploads a diagram
const uploadFormData = new FormData();
uploadFormData.append('file', selectedFile);
uploadFormData.append('bcProjectId', project.id);

const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: uploadFormData
});

const { diagram } = await uploadResponse.json();

// 3. AI categorizes the document
const categorizationResponse = await fetch('/api/ai/categorize-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: diagram.fileUrl,
    fileName: diagram.fileName,
    fileType: diagram.fileType
  })
});

const categorization = await categorizationResponse.json();
// { category: "STRUCTURAL STEEL", confidence: 0.92, ... }

// 4. User confirms category (or selects alternative)
const selectedCategory = "STRUCTURAL STEEL";

// 5. Create bid package
const packageResponse = await fetch('/api/bid-packages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `${selectedCategory} - ${diagram.fileName}`,
    description: `Bid package for ${selectedCategory}`,
    status: 'active',
    projectId: project.id,
    diagramIds: [diagram.id]
  })
});

const { bidPackage } = await packageResponse.json();

// 6. Create bid form
const formResponse = await fetch('/api/bid-forms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: diagram.fileName,
    bidPackageId: bidPackage.id,
    diagramId: diagram.id
  })
});

const { bidForm } = await formResponse.json();

// 7. Extract line items
const extractResponse = await fetch('/api/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: diagram.fileUrl,
    bidPackageId: bidPackage.id
  })
});

const { line_items } = await extractResponse.json();
// Line items are automatically saved to bidForm in database

// 8. Load bid package for editing
const loadResponse = await fetch(`/api/bid-packages/${bidPackage.id}`);
const { bidPackage: fullBidPackage } = await loadResponse.json();

// fullBidPackage.bidForms[0].lineItems[] contains all extracted items

// 9. User edits a line item
const lineItem = fullBidPackage.bidForms[0].lineItems[0];
await fetch(`/api/bid-forms/${bidForm.id}/line-items/${lineItem.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quantity: 100,
    unit_price: 25.00,
    total_price: 2500.00,
    verified: true
  })
});

// 10. Mark bid form as completed
await fetch(`/api/bid-forms/${bidForm.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'completed'
  })
});
```

---

## Error Handling

### Upload Errors

```typescript
if (!uploadResponse.ok) {
  if (uploadResponse.status === 400) {
    // Missing file or bcProjectId
    console.error('Missing required upload parameters');
  } else if (uploadResponse.status === 500) {
    // Server error (disk full, permissions, etc.)
    console.error('Server error during upload');
  }
}
```

### Extraction Errors

```typescript
if (!extractResponse.ok) {
  const error = await extractResponse.json();
  if (error.details?.includes('Failed to fetch image')) {
    // Image file not accessible
  } else if (error.details?.includes('Failed to parse')) {
    // Claude returned invalid JSON
  }
}
```

### Database Errors

```typescript
// Prisma error codes
if (error.code === 'P2025') {
  // Record not found
} else if (error.code === 'P2002') {
  // Unique constraint violation
} else if (error.code === 'P2003') {
  // Foreign key constraint violation
}
```

---

## Performance Considerations

### Database Queries

**Always use includes for relations** to avoid N+1 queries:

```typescript
// ✅ Good: Single query with includes
const bidPackage = await prisma.bidPackage.findUnique({
  where: { id },
  include: {
    bidForms: {
      include: {
        lineItems: true,
        diagram: true
      }
    }
  }
});

// ❌ Bad: Multiple queries
const bidPackage = await prisma.bidPackage.findUnique({ where: { id } });
const bidForms = await prisma.bidForm.findMany({ where: { bidPackageId: id } });
// ... more queries for each relation
```

### File Storage

- Files stored locally in `/public/uploads/`
- **Production**: Should migrate to Vercel Blob or S3
- **Cleanup**: No automatic deletion - implement garbage collection

### AI API Calls

- Claude API has rate limits (check Anthropic dashboard)
- Requests are synchronous (user waits for response)
- **Improvement**: Consider background job queue for extraction

---

## Testing & Development

### Seed Data

```bash
# Create mock BuildingConnected project
npx tsx scripts/seed-project.ts
```

### Reset Database

```bash
# WARNING: Deletes all data
npx prisma db push --force-reset
npx prisma generate
npx tsx scripts/seed-project.ts
```

### View Database

```bash
# Open Prisma Studio GUI
npx prisma studio
# Navigate to http://localhost:5555
```

---

## Future Enhancements

### Ready for Implementation

1. **BuildingConnected API Integration**
   - Webhook listener for new projects
   - Automatic project sync
   - Bidder contact management

2. **Multi-Diagram Support**
   - Bid packages with multiple diagrams
   - Cross-diagram line item references
   - Diagram comparison view

3. **Verification Workflow**
   - Admin review queue
   - Approval/rejection system
   - Audit trail (VerificationRecord model ready)

4. **Export Formats**
   - PDF generation (jsPDF ready in `lib/export.ts`)
   - Excel export (XLSX ready)
   - CSV export (implemented)

5. **Collaboration**
   - User assignments (UserAssignment model ready)
   - Comments on line items
   - Real-time updates (WebSocket)

---

## Troubleshooting

### "Bid package shows empty screen"

- **Cause**: Line items not loaded from database
- **Fix**: Ensure `handleBidPackageSelect` loads `bidPackage.bidForms[].lineItems[]`

### "Upload fails with 400"

- **Cause**: Missing `bcProjectId` in FormData
- **Fix**: Verify `formData.append('bcProjectId', project.id)` is called

### "AI categorization fails"

- **Cause**: Wrong Claude model name or missing API key
- **Fix**: Use `claude-sonnet-4-5-20250929` and check `ANTHROPIC_API_KEY`

### "Route params error"

- **Cause**: Next.js 15+ requires awaiting params
- **Fix**: Use `{ params: Promise<{ id: string }> }` and `const { id } = await params;`

---

**Last Updated**: 2025-11-21
**Version**: 1.0
