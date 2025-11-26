/**
 * In-Memory Authentication Store
 * For development purposes - bypasses database requirement
 */

import bcrypt from 'bcrypt';
import { UserPublic, UserRole } from '@/types/user';

interface StoredUser {
  id: string;
  email: string;
  userName: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory storage
const users: Map<string, StoredUser> = new Map();
const sessions: Map<string, Session> = new Map();
const emailToUserId: Map<string, string> = new Map();

// Create a default test user on initialization
const defaultUser: StoredUser = {
  id: 'user_test_1',
  email: 'test@example.com',
  userName: 'testuser',
  passwordHash: bcrypt.hashSync('password123', 10), // password: password123
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

users.set(defaultUser.id, defaultUser);
emailToUserId.set(defaultUser.email, defaultUser.id);

console.log('✅ In-memory auth initialized with test user (test@example.com / password123)');

// Helper to convert StoredUser to UserPublic
function toUserPublic(user: StoredUser): UserPublic {
  return {
    id: user.id,
    email: user.email,
    userName: user.userName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: null,
    role: user.role,
    passwordResetRequired: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };
}

// Generate session token
function generateToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export const inMemoryAuth = {
  // Create a new user
  async createUser(data: {
    email: string;
    userName: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<UserPublic> {
    // Check if email already exists
    if (emailToUserId.has(data.email)) {
      throw new Error('Email already exists');
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user: StoredUser = {
      id: userId,
      email: data.email,
      userName: data.userName,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.PRECON_ANALYST, // Default role for new users
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    users.set(userId, user);
    emailToUserId.set(data.email, userId);

    return toUserPublic(user);
  },

  // Find user by email
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const userId = emailToUserId.get(email);
    if (!userId) return null;
    return users.get(userId) || null;
  },

  // Verify password
  async verifyPassword(user: StoredUser, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  },

  // Create session
  async createSession(userId: string): Promise<string> {
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const session: Session = {
      token,
      userId,
      expiresAt,
      createdAt: new Date(),
    };

    sessions.set(token, session);
    return token;
  },

  // Get session
  async getSession(token: string): Promise<Session | null> {
    const session = sessions.get(token);
    if (!session) return null;

    // Check if expired
    if (session.expiresAt < new Date()) {
      sessions.delete(token);
      return null;
    }

    return session;
  },

  // Get user by session token
  async getUserByToken(token: string): Promise<UserPublic | null> {
    const session = await this.getSession(token);
    if (!session) return null;

    const user = users.get(session.userId);
    if (!user) return null;

    return toUserPublic(user);
  },

  // Delete session (logout)
  async deleteSession(token: string): Promise<void> {
    sessions.delete(token);
  },

  // Clean up expired sessions (optional, for maintenance)
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(token);
      }
    }
  },
};

// Cleanup expired sessions every hour
setInterval(() => {
  inMemoryAuth.cleanupExpiredSessions();
}, 60 * 60 * 1000);
