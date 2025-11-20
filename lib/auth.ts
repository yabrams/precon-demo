/**
 * Authentication Middleware and Utilities
 * Provides functions for verifying JWT tokens and protecting routes
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';
import { JWTPayload, UserPublic } from '@/types/user';
import { Permission, Role, ROLE_PERMISSIONS } from '@/types/rbac';

const prisma = new PrismaClient();

// JWT secret key
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

/**
 * Extracts JWT token from request (cookie or Authorization header)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  return cookieToken || headerToken;
}

/**
 * Verifies JWT token and returns the payload
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Gets the current authenticated user from request
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<UserPublic | null> {
  const token = getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  // Verify JWT token
  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  // Check if session exists in database
  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.session.delete({
      where: { token },
    });
    return null;
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !user.isActive) {
    return null;
  }

  // Return user without password hash
  const { passwordHash: _, ...userPublic } = user;
  return userPublic;
}

/**
 * Middleware to require authentication for API routes
 * Usage:
 *   const user = await requireAuth(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function requireAuth(
  request: NextRequest
): Promise<UserPublic | null> {
  return getCurrentUser(request);
}

/**
 * Check if user has permission for a specific action on a bid package
 */
export async function checkBidPackagePermission(
  userId: string,
  bidPackageId: string,
  permission: Permission
): Promise<{ hasPermission: boolean; role?: Role; message?: string }> {
  try {
    // Find user's assignment to this bid package
    const assignment = await prisma.userAssignment.findFirst({
      where: {
        userId,
        bidPackageId,
      },
    });

    if (!assignment) {
      return {
        hasPermission: false,
        message: 'User not assigned to this bid package',
      };
    }

    const role = assignment.role as Role;
    const rolePermissions = ROLE_PERMISSIONS[role];

    if (!rolePermissions) {
      return {
        hasPermission: false,
        message: 'Invalid role',
      };
    }

    const hasPermission = rolePermissions.includes(permission);

    return {
      hasPermission,
      role,
      message: hasPermission
        ? undefined
        : `Role '${role}' does not have permission '${permission}'`,
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      message: 'Error checking permissions',
    };
  }
}

/**
 * Check if user has permission for a specific action on a project
 */
export async function checkProjectPermission(
  userId: string,
  bcProjectId: string,
  permission: Permission
): Promise<{ hasPermission: boolean; role?: Role; message?: string }> {
  try {
    // Find user's assignment to this project
    const assignment = await prisma.userAssignment.findFirst({
      where: {
        userId,
        bcProjectId,
      },
    });

    if (!assignment) {
      return {
        hasPermission: false,
        message: 'User not assigned to this project',
      };
    }

    const role = assignment.role as Role;
    const rolePermissions = ROLE_PERMISSIONS[role];

    if (!rolePermissions) {
      return {
        hasPermission: false,
        message: 'Invalid role',
      };
    }

    const hasPermission = rolePermissions.includes(permission);

    return {
      hasPermission,
      role,
      message: hasPermission
        ? undefined
        : `Role '${role}' does not have permission '${permission}'`,
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      message: 'Error checking permissions',
    };
  }
}

/**
 * Get all bid packages the user has access to
 */
export async function getUserBidPackages(userId: string) {
  try {
    const assignments = await prisma.userAssignment.findMany({
      where: {
        userId,
        bidPackageId: { not: null },
      },
      include: {
        bidPackage: {
          include: {
            project: true,
          },
        },
      },
    });

    return assignments
      .filter((a) => a.bidPackage !== null)
      .map((a) => ({
        ...a.bidPackage!,
        userRole: a.role as Role,
      }));
  } catch (error) {
    console.error('Error getting user bid packages:', error);
    return [];
  }
}

/**
 * Get all projects the user has access to
 */
export async function getUserProjects(userId: string) {
  try {
    // Get projects the user is directly assigned to
    const directAssignments = await prisma.userAssignment.findMany({
      where: {
        userId,
        bcProjectId: { not: null },
      },
      include: {
        project: {
          include: {
            bidPackages: true,
          },
        },
      },
    });

    // Get projects through bid package assignments
    const bidPackageAssignments = await prisma.userAssignment.findMany({
      where: {
        userId,
        bidPackageId: { not: null },
      },
      include: {
        bidPackage: {
          include: {
            project: {
              include: {
                bidPackages: true,
              },
            },
          },
        },
      },
    });

    // Combine and deduplicate projects
    const projectsMap = new Map();

    directAssignments.forEach((a) => {
      if (a.project) {
        projectsMap.set(a.project.id, {
          ...a.project,
          userRole: a.role as Role,
          assignmentType: 'project',
        });
      }
    });

    bidPackageAssignments.forEach((a) => {
      if (a.bidPackage?.project && !projectsMap.has(a.bidPackage.project.id)) {
        projectsMap.set(a.bidPackage.project.id, {
          ...a.bidPackage.project,
          userRole: a.role as Role,
          assignmentType: 'bidPackage',
        });
      }
    });

    return Array.from(projectsMap.values());
  } catch (error) {
    console.error('Error getting user projects:', error);
    return [];
  }
}
