/**
 * Admin User Management - Individual User Operations
 * PUT /api/admin/users/[id] - Update user
 * DELETE /api/admin/users/[id] - Soft delete user
 * Only accessible to Admin and Precon Lead roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { UserRole, UserUpdateInput } from '@/types/user';

/**
 * PUT - Update user information
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require Admin or Precon Lead role
    const { user: currentUser, response } = await requireRole(request, [
      UserRole.ADMIN,
      UserRole.PRECON_LEAD,
    ]);

    if (response) return response;

    const { id: userId } = await params;
    const body: UserUpdateInput = await request.json();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate role if being updated
    if (body.role && !Object.values(UserRole).includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    // Check for email uniqueness if changing
    if (body.email && body.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }
    }

    // Check for username uniqueness if changing
    if (body.userName && body.userName !== existingUser.userName) {
      const usernameExists = await prisma.user.findUnique({
        where: { userName: body.userName },
      });
      if (usernameExists) {
        return NextResponse.json(
          { error: 'Username already in use' },
          { status: 409 }
        );
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: body.email,
        userName: body.userName,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        isActive: body.isActive,
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
        message: 'User updated successfully',
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Soft delete user (set isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require Admin or Precon Lead role
    const { user: currentUser, response } = await requireRole(request, [
      UserRole.ADMIN,
      UserRole.PRECON_LEAD,
    ]);

    if (response) return response;

    const { id: userId } = await params;

    // Prevent self-deletion
    if (userId === currentUser!.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting the last admin
    if (user.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last active admin user' },
          { status: 400 }
        );
      }
    }

    // Soft delete - set isActive to false
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        userName: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    // Also delete all active sessions for this user
    await prisma.session.deleteMany({
      where: { userId },
    });

    return NextResponse.json(
      {
        message: 'User deactivated successfully',
        user: deletedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
