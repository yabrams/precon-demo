/**
 * Bid Package Types
 * Bid packages are scopes of work within a BuildingConnected project
 * Bid packages reference diagrams from their parent project (not own them)
 */

import { LineItem } from '@/components/BidFormTable';
import { Diagram } from './diagram';

// Type alias for all valid bid package statuses
// Includes both new workflow states and legacy states for backward compatibility
export type BidPackageStatus = 'to do' | 'assigned' | 'in progress' | 'in review' | 'completed' | 'active' | 'bidding' | 'bidding-leveling' | 'pending-review' | 'awarded';

export interface BidPackage {
  // Core identifiers
  id: string; // Internal database ID
  bcBidPackageId: string; // BuildingConnected's bid package ID
  bcProjectId: string; // Parent BC project ID

  // Basic information
  name: string;

  // Dates
  bidDueDate?: Date;

  // Status tracking (workflow-controlled, not user-editable)
  status: BidPackageStatus;
  progress: number; // 0-100 percentage

  // Assignment
  captainId?: string; // User ID of the package captain
  captain?: { // Captain user object (populated from relation)
    id: string;
    userName: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  captainName?: string; // Legacy field - kept for backward compatibility

  // Diagram references (diagrams are owned by parent project)
  diagramIds?: string[]; // IDs of diagrams from parent project to use for this package

  // Workspace data (flexible JSON storage)
  workspaceData?: string; // JSON string containing lineItems, chatMessages, etc.

  // Relations (will be populated by database queries)
  bidForms?: any[]; // Will be BidForm[] when imported
  userAssignments?: any[]; // Will be UserAssignment[] when imported

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface BidPackageWithDetails extends BidPackage {
  // Extended version with populated relations
  // Note: diagrams are referenced from parent project, not owned by package
  diagrams?: Diagram[]; // Resolved from parent project using diagramIds
  bidForms: {
    id: string;
    status: string;
    lineItems: LineItem[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  userAssignments: {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    role: 'viewer' | 'editor' | 'owner';
  }[];
  // Project context (includes all project diagrams)
  project?: {
    id: string;
    name: string;
    projectNumber?: string;
    diagrams?: Diagram[]; // All diagrams available at project level
  };
}

export interface BidPackageCreateInput {
  bcBidPackageId: string;
  bcProjectId: string;
  name: string;
  bidDueDate?: Date;
  status?: BidPackageStatus;
}

export interface BidPackageUpdateInput {
  name?: string;
  bidDueDate?: Date;
  status?: BidPackageStatus;
  progress?: number;
  diagramIds?: string[]; // Update which diagrams from project to use
}

// Summary view for displaying bid packages in lists
export interface BidPackageSummary {
  id: string;
  bcBidPackageId: string;
  name: string;
  status: BidPackageStatus;
  progress: number;
  bidDueDate?: Date;
  diagramCount: number;
  assignedUserCount: number;
  assignedUsers: {
    userId: string;
    userName: string;
    role: 'viewer' | 'editor' | 'owner';
  }[];
}
