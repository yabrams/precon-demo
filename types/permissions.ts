/**
 * Permission System for Organizational Roles
 * Defines capabilities for each role in the system
 */

import { UserRole } from './user';

// System-level permissions
export enum Permission {
  // User Management
  MANAGE_USERS = 'manage_users',
  VIEW_ALL_USERS = 'view_all_users',

  // Project Access
  VIEW_ALL_PROJECTS = 'view_all_projects',
  CREATE_PROJECT = 'create_project',
  DELETE_PROJECT = 'delete_project',

  // Diagram Management
  UPLOAD_DIAGRAMS = 'upload_diagrams',
  DELETE_DIAGRAMS = 'delete_diagrams',

  // Bid Form Operations
  EDIT_LINE_ITEMS = 'edit_line_items',
  VERIFY_BID_FORMS = 'verify_bid_forms',
  EXPORT_DATA = 'export_data',

  // Assignment Management
  MANAGE_ASSIGNMENTS = 'manage_assignments',
}

// Permission sets for each organizational role
export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Full system access
    Permission.MANAGE_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_PROJECTS,
    Permission.CREATE_PROJECT,
    Permission.DELETE_PROJECT,
    Permission.UPLOAD_DIAGRAMS,
    Permission.DELETE_DIAGRAMS,
    Permission.EDIT_LINE_ITEMS,
    Permission.VERIFY_BID_FORMS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_ASSIGNMENTS,
  ],

  [UserRole.PRECON_LEAD]: [
    // User management + all project capabilities
    Permission.MANAGE_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_PROJECTS,
    Permission.CREATE_PROJECT,
    Permission.UPLOAD_DIAGRAMS,
    Permission.DELETE_DIAGRAMS,
    Permission.EDIT_LINE_ITEMS,
    Permission.VERIFY_BID_FORMS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_ASSIGNMENTS,
  ],

  [UserRole.SCOPE_CAPTAIN]: [
    // Project editing capabilities (assigned projects only)
    Permission.VIEW_ALL_PROJECTS, // Can see all projects
    Permission.UPLOAD_DIAGRAMS,
    Permission.EDIT_LINE_ITEMS,
    Permission.VERIFY_BID_FORMS,
    Permission.EXPORT_DATA,
  ],

  [UserRole.PRECON_ANALYST]: [
    // View and limited export (assigned projects only)
    Permission.EXPORT_DATA,
  ],
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if user can manage users (Admin or Precon Lead only)
 */
export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PRECON_LEAD;
}

/**
 * Check if user can access admin features
 */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}
