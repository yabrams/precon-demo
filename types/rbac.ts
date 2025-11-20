/**
 * Role-Based Access Control (RBAC) Types
 * Defines roles, permissions, and user assignments to bid packages
 */

// Role types with hierarchical permissions
export type Role = 'viewer' | 'editor' | 'owner';

// Permission types for different actions
export type Permission =
  | 'view_bid_package'
  | 'edit_line_items'
  | 'upload_diagrams'
  | 'delete_diagrams'
  | 'export_data'
  | 'manage_assignments'
  | 'delete_bid_package';

// Role-to-Permission mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ['view_bid_package', 'export_data'],
  editor: [
    'view_bid_package',
    'edit_line_items',
    'upload_diagrams',
    'export_data',
  ],
  owner: [
    'view_bid_package',
    'edit_line_items',
    'upload_diagrams',
    'delete_diagrams',
    'export_data',
    'manage_assignments',
    'delete_bid_package',
  ],
};

// User assignment to a bid package with a specific role
export interface UserAssignment {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: Role;

  // Assignment can be to either a project OR a bid package
  bcProjectId?: string;
  bidPackageId?: string;

  // Assignment metadata
  assignedAt: Date;
  assignedBy?: string; // User ID of who made the assignment

  // User details (populated from User table)
  user?: {
    id: string;
    email: string;
    userName: string;
    firstName?: string;
    lastName?: string;
  };
}

// Input for creating a new assignment
export interface UserAssignmentCreateInput {
  userId: string;
  role: Role;
  bidPackageId?: string;
  bcProjectId?: string;
  assignedBy?: string;
}

// Input for updating an existing assignment
export interface UserAssignmentUpdateInput {
  role?: Role;
}

// Summary of a user's assignments
export interface UserAssignmentSummary {
  userId: string;
  userName: string;
  userEmail: string;
  role: Role;
  assignedAt: Date;
  bidPackageName?: string;
  projectName?: string;
}

// Permission check result
export interface PermissionCheck {
  hasPermission: boolean;
  role?: Role;
  message?: string;
}

// Helper function type for checking permissions
export type CheckPermission = (
  userId: string,
  bidPackageId: string,
  permission: Permission
) => Promise<PermissionCheck>;
