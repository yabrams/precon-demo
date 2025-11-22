import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/users
 * Get all active users in the system
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active users (excluding password hashes)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        userName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
        { userName: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
