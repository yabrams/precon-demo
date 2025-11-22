/**
 * Authentication Middleware and Utilities
 * Provides functions for verifying JWT tokens and protecting routes
 * Updated to use organizational role-based access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { JWTPayload, UserPublic, UserRole } from '@/types/user';
import { Permission, hasPermission, canManageUsers } from '@/types/permissions';
import { prisma } from '@/lib/prisma';


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
    // Validate payload has required fields
    if (
      typeof payload.userId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.userName === 'string' &&
      typeof payload.role === 'string'
    ) {
      return payload as unknown as JWTPayload;
    }
    return null;
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
    select: {
      id: true,
      email: true,
      userName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      passwordResetRequired: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user as UserPublic;
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
 * Require specific roles for API routes
 * Returns 403 error response if user doesn't have required role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<{ user: UserPublic; response: null } | { user: null; response: NextResponse }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Forbidden - insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

/**
 * Check if user has a specific permission based on their organizational role
 */
export function checkUserPermission(
  user: UserPublic,
  permission: Permission
): boolean {
  return hasPermission(user.role, permission);
}

/**
 * Check if user can manage other users (Admin or Precon Lead only)
 */
export function checkCanManageUsers(user: UserPublic): boolean {
  return canManageUsers(user.role);
}

/**
 * Check if user is assigned to a specific project
 * (Used for Scope Captain and Precon Analyst who can only access assigned projects)
 */
export async function isUserAssignedToProject(
  userId: string,
  bcProjectId: string
): Promise<boolean> {
  try {
    const assignment = await prisma.userAssignment.findFirst({
      where: {
        userId,
        bcProjectId,
      },
    });
    return !!assignment;
  } catch (error) {
    console.error('Error checking project assignment:', error);
    return false;
  }
}

/**
 * Check if user is assigned to a specific bid package
 * (Used for Scope Captain and Precon Analyst who can only access assigned bid packages)
 */
export async function isUserAssignedToBidPackage(
  userId: string,
  bidPackageId: string
): Promise<boolean> {
  try {
    const assignment = await prisma.userAssignment.findFirst({
      where: {
        userId,
        bidPackageId,
      },
    });
    return !!assignment;
  } catch (error) {
    console.error('Error checking bid package assignment:', error);
    return false;
  }
}

/**
 * Get all bid packages the user has access to
 * Admins and Precon Leads see all, others see only assigned packages
 */
export async function getUserBidPackages(userId: string, userRole: UserRole) {
  try {
    // Admins and Precon Leads can see all bid packages
    if (userRole === UserRole.ADMIN || userRole === UserRole.PRECON_LEAD) {
      return await prisma.bidPackage.findMany({
        include: {
          project: true,
        },
      });
    }

    // Other roles only see assigned bid packages
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
      .filter((a: typeof assignments[number]) => a.bidPackage !== null)
      .map((a: typeof assignments[number]) => a.bidPackage!);
  } catch (error) {
    console.error('Error getting user bid packages:', error);
    return [];
  }
}

/**
 * Get all projects the user has access to
 * Admins and Precon Leads see all, Scope Captains see all, Analysts see only assigned
 */
export async function getUserProjects(userId: string, userRole: UserRole) {
  try {
    // Admins, Precon Leads, and Scope Captains can see all projects
    if (
      userRole === UserRole.ADMIN ||
      userRole === UserRole.PRECON_LEAD ||
      userRole === UserRole.SCOPE_CAPTAIN
    ) {
      return await prisma.buildingConnectedProject.findMany({
        include: {
          bidPackages: true,
        },
      });
    }

    // Precon Analysts only see assigned projects
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

    directAssignments.forEach((a: typeof directAssignments[number]) => {
      if (a.project) {
        projectsMap.set(a.project.id, a.project);
      }
    });

    bidPackageAssignments.forEach((a: typeof bidPackageAssignments[number]) => {
      if (a.bidPackage?.project && !projectsMap.has(a.bidPackage.project.id)) {
        projectsMap.set(a.bidPackage.project.id, a.bidPackage.project);
      }
    });

    return Array.from(projectsMap.values());
  } catch (error) {
    console.error('Error getting user projects:', error);
    return [];
  }
}
