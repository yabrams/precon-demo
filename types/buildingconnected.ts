/**
 * BuildingConnected Project Types
 * Based on BuildingConnected API v2 structure
 * https://aps.autodesk.com/en/docs/buildingconnected/v2/reference/http/buildingconnected-projects-GET/
 */

import { Diagram } from './diagram';

export interface BuildingConnectedLocation {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface BuildingConnectedProject {
  // Core identifiers
  id: string; // Internal database ID
  bcProjectId: string; // BuildingConnected's 24-char project ID
  accProjectId?: string; // Autodesk Construction Cloud UUID if linked
  accDocsFolderId?: string; // ACC Docs folder ID

  // Basic information
  name: string;
  projectNumber?: string;
  description?: string;
  status: 'active' | 'bidding' | 'awarded' | 'closed' | 'archived';

  // Dates
  bidDueDate?: Date;
  expectedStartDate?: Date;
  expectedEndDate?: Date;

  // Location
  location?: BuildingConnectedLocation;

  // Project details
  projectSize?: number;
  projectSizeUnit?: string; // 'SF', 'square meters', etc.
  projectValue?: number; // Estimated value in dollars
  marketSector?: string; // 'Commercial', 'Healthcare', 'Education', etc.
  typeOfWork?: string; // 'New Construction', 'Renovation', 'Addition', etc.

  // Parties involved
  architect?: string;
  client?: string; // Owner/client name
  accountManager?: string;
  owningOffice?: string;
  feePercentage?: number;

  // Precon Lead (user with PRECON_LEAD or ADMIN role)
  preconLeadId?: string;
  preconLeadEmail?: string;
  preconLeadName?: string;
  preconLeadAvatar?: string;

  // Sync metadata
  lastSyncedAt?: Date;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Relations (will be populated by database queries)
  diagrams?: Diagram[]; // Project-level diagrams
  bidPackages?: any[]; // Will be BidPackage[] when that type is imported
  userAssignments?: any[]; // Will be UserAssignment[] when that type is imported
}

export interface BuildingConnectedProjectCreateInput {
  bcProjectId: string;
  name: string;
  projectNumber?: string;
  description?: string;
  status?: 'active' | 'bidding' | 'awarded' | 'closed' | 'archived';
  bidDueDate?: Date;
  expectedStartDate?: Date;
  expectedEndDate?: Date;
  location?: BuildingConnectedLocation;
  projectSize?: number;
  projectSizeUnit?: string;
  projectValue?: number;
  marketSector?: string;
  typeOfWork?: string;
  architect?: string;
  client?: string;
  accountManager?: string;
  owningOffice?: string;
  feePercentage?: number;
}

export interface BuildingConnectedProjectUpdateInput {
  name?: string;
  projectNumber?: string;
  description?: string;
  status?: 'active' | 'bidding' | 'awarded' | 'closed' | 'archived';
  bidDueDate?: Date;
  expectedStartDate?: Date;
  expectedEndDate?: Date;
  location?: BuildingConnectedLocation;
  projectSize?: number;
  projectSizeUnit?: string;
  projectValue?: number;
  marketSector?: string;
  typeOfWork?: string;
  architect?: string;
  client?: string;
  accountManager?: string;
  owningOffice?: string;
  feePercentage?: number;
  preconLeadId?: string;
  preconLeadEmail?: string;
  preconLeadName?: string;
  preconLeadAvatar?: string;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
}

// Filter and query types for BC projects
export interface BuildingConnectedProjectFilters {
  status?: 'active' | 'bidding' | 'awarded' | 'closed' | 'archived';
  marketSector?: string;
  bidDueDateFrom?: Date;
  bidDueDateTo?: Date;
  searchQuery?: string; // Search in name, description, project number
}
