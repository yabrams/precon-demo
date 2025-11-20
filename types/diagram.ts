/**
 * Diagram Types
 * Diagrams are construction drawings/plans at the project level
 * Multiple bid packages within a project can reference the same diagrams
 */

export interface Diagram {
  // Core identifiers
  id: string;
  bcProjectId: string; // Parent BuildingConnected project ID

  // File information
  fileName: string;
  fileUrl: string;
  fileType: string; // e.g., 'image/png', 'application/pdf'
  fileSize: number; // Size in bytes

  // Metadata
  uploadedAt: Date;
  uploadedBy?: string; // User ID who uploaded

  // Optional categorization
  category?: string; // e.g., 'Floor Plan', 'Elevation', 'Detail', 'Site Plan'
  description?: string;
  tags?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagramCreateInput {
  bcProjectId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy?: string;
  category?: string;
  description?: string;
  tags?: string[];
}

export interface DiagramUpdateInput {
  fileName?: string;
  category?: string;
  description?: string;
  tags?: string[];
}

// Summary view for displaying diagrams in lists
export interface DiagramSummary {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  category?: string;
}
