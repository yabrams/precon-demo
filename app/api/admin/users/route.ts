/**
 * Admin User Management API
 * GET /api/admin/users - List all users (with filtering)
 * POST /api/admin/users - Create new user
 * Only accessible to Admin and Precon Lead roles
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { UserRole, UserCreateInput } from '@/types/user';

/**
 * Generate a random temporary password
 */
function generateTempPassword(): string {
  const length = 12;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * GET - List all users with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Require Admin or Precon Lead role
    const { user, response } = await requireRole(request, [
      UserRole.ADMIN,
      UserRole.PRECON_LEAD,
    ]);

    if (response) return response;

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') as UserRole | null;
    const activeFilter = searchParams.get('active');

    // Build filter object
    const where: any = {};
    if (roleFilter && Object.values(UserRole).includes(roleFilter)) {
      where.role = roleFilter;
    }
    if (activeFilter === 'true') {
      where.isActive = true;
    } else if (activeFilter === 'false') {
      where.isActive = false;
    }

    // Fetch users without password hashes
    const users = await prisma.user.findMany({
      where,
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
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new user (Admin/Precon Lead only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require Admin or Precon Lead role
    const { user: currentUser, response } = await requireRole(request, [
      UserRole.ADMIN,
      UserRole.PRECON_LEAD,
    ]);

    if (response) return response;

    const body: UserCreateInput = await request.json();

    // Validate required fields
    if (!body.email || !body.userName || !body.role) {
      return NextResponse.json(
        { error: 'Email, username, and role are required' },
        { status: 400 }
      );
    }

    // Validate role enum
    if (!Object.values(UserRole).includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    // Check for existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    // Check for existing username
    const existingUsername = await prisma.user.findUnique({
      where: { userName: body.userName },
    });
    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username already in use' },
        { status: 409 }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: body.email,
        userName: body.userName,
        firstName: body.firstName,
        lastName: body.lastName,
        passwordHash,
        role: body.role,
        passwordResetRequired: true,
        isActive: true,
      },
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

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: newUser,
        tempPassword, // Return temp password so admin can share it
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
