/**
 * User and Authentication Types
 * Basic authentication system with role-based access control
 */

export interface User {
  id: string;
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  passwordHash: string; // bcrypt hashed password
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Public user info (safe to send to client)
export interface UserPublic {
  id: string;
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

// User registration input
export interface UserRegisterInput {
  email: string;
  userName: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// User login input
export interface UserLoginInput {
  email: string;
  password: string;
}

// User profile update input
export interface UserUpdateInput {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
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
