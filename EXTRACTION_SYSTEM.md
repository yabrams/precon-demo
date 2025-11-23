# Enhanced Document Extraction System

## Overview

The enhanced extraction system provides intelligent document processing with automatic categorization, duplicate detection, and bid package organization. The system processes construction documents to extract bid items, categorizes them by trade, and automatically creates organized bid packages.

## Key Features

### 1. File Duplicate Detection
- **SHA-256 Hashing**: Every uploaded file is hashed to create a unique fingerprint
- **Database Storage**: Hashes are stored in the `Diagram.fileHash` field
- **Duplicate Handling**: When a duplicate is detected:
  - Option 1: Create a copy with "COPY X" prefix
  - Option 2: Reuse existing extracted data
- **Smart Naming**: Automatic copy numbering (e.g., "Project" → "COPY 1 Project" → "COPY 2 Project")

### 2. Multi-File Upload & Batch Processing
- **Bulk Upload**: Upload multiple diagrams simultaneously
- **Progress Tracking**: Real-time upload progress for each file
- **Parallel Processing**: Files are processed concurrently for efficiency
- **Batch Extraction**: Extract data from multiple diagrams in one operation

### 3. Automatic Bid Package Creation
- **Trade Categories**: 11+ predefined trade categories:
  - Plumbing
  - Electrical
  - HVAC
  - Framing
  - Drywall
  - Flooring
  - Roofing
  - Concrete
  - Painting
  - Landscaping
  - General Conditions
  - General (catch-all)

- **Smart Categorization**: AI-powered categorization using keywords and patterns
- **Auto-Organization**: Items are automatically grouped into appropriate bid packages
- **Package Management**: Each package maintains its own bid forms and line items

### 4. Data Persistence
- **Full Database Storage**: All extracted data is saved to PostgreSQL
- **Relational Structure**:
  ```
  BuildingConnectedProject
    └── BidPackage (by trade)
          └── BidForm
                └── LineItem (categorized items)
  ```
- **Transaction Safety**: Batch operations use database transactions
- **Data Integrity**: Cascading deletes maintain referential integrity

## API Endpoints

### `/api/upload` (Enhanced)
- Accepts single or multiple files
- Calculates file hashes
- Detects duplicates
- Returns duplicate information with suggested names

**Request:**
```javascript
const formData = new FormData();
formData.append('file', file1);
formData.append('file', file2); // Multiple files supported
formData.append('bcProjectId', projectId); // Optional
```

**Response:**
```json
{
  "files": [
    {
      "url": "/uploads/file1.pdf",
      "fileName": "file1.pdf",
      "fileHash": "abc123...",
      "isDuplicate": false
    },
    {
      "url": "/uploads/file2.pdf",
      "fileName": "file2.pdf",
      "fileHash": "def456...",
      "isDuplicate": true,
      "existingProjectName": "Original Project",
      "suggestedProjectName": "COPY 1 Original Project"
    }
  ]
}
```

### `/api/extract/batch` (New)
- Processes multiple diagrams simultaneously
- Creates bid packages automatically
- Categorizes items by trade
- Handles duplicate projects

**Request:**
```json
{
  "diagrams": [
    {
      "diagramId": "diagram1",
      "imageUrl": "/uploads/diagram1.pdf",
      "fileName": "diagram1.pdf",
      "fileHash": "hash1"
    }
  ],
  "bcProjectId": "project_id",
  "createNewProject": true,
  "projectName": "New Construction Project",
  "isDuplicate": false
}
```

**Response:**
```json
{
  "success": true,
  "projectId": "project_123",
  "projectName": "New Construction Project",
  "message": "Successfully extracted 150 items across 5 bid packages",
  "bidPackages": [
    {
      "id": "bp_1",
      "name": "Plumbing Package",
      "category": "Plumbing",
      "itemCount": 35,
      "bidFormId": "form_1"
    },
    {
      "id": "bp_2",
      "name": "Electrical Package",
      "category": "Electrical",
      "itemCount": 42,
      "bidFormId": "form_2"
    }
  ]
}
```

## Component Usage

### MultiDiagramUpload Component

```tsx
import MultiDiagramUpload from '@/components/MultiDiagramUpload';

function MyComponent() {
  return (
    <MultiDiagramUpload
      bcProjectId={projectId} // Optional: existing project
      onExtractionComplete={(result) => {
        console.log(`Created ${result.bidPackages.length} bid packages`);
        // Navigate to project view
      }}
      onCancel={() => {
        // Handle cancellation
      }}
    />
  );
}
```

## Utility Functions

### File Utilities (`lib/file-utils.ts`)
- `calculateFileHash(filePath)`: Generate SHA-256 hash from file
- `calculateBufferHash(buffer)`: Generate hash from buffer
- `checkDuplicateFile(fileHash)`: Check if file exists in database
- `generateCopyName(originalName, existingNames)`: Generate copy name with number
- `processFilesForDuplicates(files)`: Process multiple files for duplicates

### Bid Package Utilities (`lib/bid-package-utils.ts`)
- `categorizeLineItem(description)`: Categorize single item by description
- `categorizeLineItems(items)`: Batch categorize items
- `createOrGetBidPackages(projectId, categories)`: Create bid packages
- `organizeIntoBidPackages(projectId, results)`: Organize extraction results
- `extractProjectName(fileName, extractedName)`: Extract project name

## Testing

Run the test suite to verify functionality:

```bash
npx tsx scripts/test-extraction-workflow.ts
```

Tests include:
- File hashing
- Duplicate detection
- Copy numbering logic
- Item categorization
- Bid package creation
- Project name extraction

## Workflow Example

1. **User uploads multiple construction diagrams**
   - System calculates hash for each file
   - Checks for duplicates in database
   - Alerts user if duplicates found

2. **User chooses handling for duplicates**
   - Create copy with new name
   - Or reuse existing data

3. **System processes all diagrams**
   - Extracts line items using Claude Vision API
   - Categorizes each item by trade
   - Groups items into bid packages

4. **Data is persisted to database**
   - Project created/updated
   - Bid packages created for each trade
   - Line items saved with categorization

5. **User receives summary**
   - Total items extracted
   - Number of bid packages created
   - Links to view each package

## Performance Considerations

- **Parallel Processing**: Multiple files processed concurrently
- **Hash Caching**: File hashes prevent redundant processing
- **Batch Operations**: Database operations use transactions
- **Lazy Loading**: Bid packages loaded on demand
- **Indexed Queries**: Database indexes on fileHash for fast lookups

## Future Enhancements

- **Email Integration**: Automatic processing of emailed diagrams
- **OCR Support**: Extract text from scanned documents
- **Custom Categories**: User-defined trade categories
- **ML Training**: Improve categorization with user feedback
- **Version Control**: Track changes between document versions
- **Approval Workflow**: Multi-step review and approval process