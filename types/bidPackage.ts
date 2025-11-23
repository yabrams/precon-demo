/**
 * Bid Package Types
 * Bid packages are scopes of work within a BuildingConnected project
 * Bid packages reference diagrams from their parent project (not own them)
 */

import { LineItem } from '@/components/BidFormTable';
import { Diagram } from './diagram';

export interface BidPackage {
  // Core identifiers
  id: string; // Internal database ID
  bcBidPackageId: string; // BuildingConnected's bid package ID
  bcProjectId: string; // Parent BC project ID

  // Basic information
  name: string;
  description?: string;
  scope?: string; // Detailed scope of work description

  // Dates
  bidDueDate?: Date;

  // Status tracking
  status: 'draft' | 'active' | 'bidding' | 'awarded' | 'closed';
  progress: number; // 0-100 percentage

  // Assignment
  captainId?: string; // User ID of the package captain
  captainName?: string; // Captain's display name (populated from user lookup)
  location?: string; // Package location or work area

  // Budget
  budgetAmount?: number; // Estimated budget for this package

  // Diagram references (diagrams are owned by parent project)
  diagramIds?: string[]; // IDs of diagrams from parent project to use for this package

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
  description?: string;
  scope?: string;
  bidDueDate?: Date;
  status?: 'draft' | 'active' | 'bidding' | 'awarded' | 'closed';
}

export interface BidPackageUpdateInput {
  name?: string;
  description?: string;
  scope?: string;
  bidDueDate?: Date;
  status?: 'draft' | 'active' | 'bidding' | 'awarded' | 'closed';
  progress?: number;
  diagramIds?: string[]; // Update which diagrams from project to use
}

// Summary view for displaying bid packages in lists
export interface BidPackageSummary {
  id: string;
  bcBidPackageId: string;
  name: string;
  status: 'draft' | 'active' | 'bidding' | 'awarded' | 'closed';
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
