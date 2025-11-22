/**
 * Admin Password Reset API
 * POST /api/admin/users/[id]/reset-password
 * Resets user password to a new temporary password
 * Only accessible to Admin and Precon Lead roles
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { UserRole } from '@/types/user';

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
 * POST - Reset user password
 */
export async function POST(
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

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Cannot reset password for inactive user' },
        { status: 400 }
      );
    }

    // Generate new temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Update user with new password and mark as requiring reset
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetRequired: true,
      },
    });

    // Invalidate all existing sessions for this user
    await prisma.session.deleteMany({
      where: { userId },
    });

    return NextResponse.json(
      {
        message: 'Password reset successfully',
        tempPassword, // Return temp password for admin to share with user
        userName: user.userName,
        email: user.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
