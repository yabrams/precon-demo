/**
 * User and Authentication Types
 * Basic authentication system with organizational role-based access control
 */

// Organizational roles (matches Prisma UserRole enum)
export enum UserRole {
  ADMIN = 'ADMIN',
  PRECON_LEAD = 'PRECON_LEAD',
  SCOPE_CAPTAIN = 'SCOPE_CAPTAIN',
  PRECON_ANALYST = 'PRECON_ANALYST',
}

// Role display labels
export const UserRoleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.PRECON_LEAD]: 'Precon Lead',
  [UserRole.SCOPE_CAPTAIN]: 'Scope Captain',
  [UserRole.PRECON_ANALYST]: 'Precon Analyst',
};

export interface User {
  id: string;
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  passwordHash: string; // bcrypt hashed password
  role: UserRole;
  passwordResetRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Public user info (safe to send to client)
// Note: Using `| null` instead of `?:` to match Prisma's return types
export interface UserPublic {
  id: string;
  email: string;
  userName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  passwordResetRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// User registration input (self-registration)
export interface UserRegisterInput {
  email: string;
  userName: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Admin user creation input
export interface UserCreateInput {
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

// User login input
export interface UserLoginInput {
  email: string;
  password: string;
}

// User profile update input (admin-initiated)
export interface UserUpdateInput {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

// Password change input
export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

// Session type for JWT tokens
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// JWT payload
export interface JWTPayload {
  userId: string;
  email: string;
  userName: string;
  role: UserRole;
  iat: number; // Issued at
  exp: number; // Expires at
}

// Auth context for use in components
export interface AuthContext {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (input: UserRegisterInput) => Promise<void>;
}
