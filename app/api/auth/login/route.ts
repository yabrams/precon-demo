/**
 * User Login API Route
 * POST /api/auth/login
 * Authenticates user and creates JWT session token
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';
import { UserLoginInput, JWTPayload } from '@/types/user';

const prisma = new PrismaClient();

// JWT secret key (in production, use environment variable)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);
const TOKEN_EXPIRY = '7d'; // 7 days

export async function POST(request: NextRequest) {
  try {
    const body: UserLoginInput = await request.json();

    // Validate input
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(body.password, user.passwordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create JWT token
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + 7 * 24 * 60 * 60) * 1000); // 7 days from now

    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
    } as Omit<JWTPayload, 'iat' | 'exp'>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(JWT_SECRET);

    // Store session in database
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Return user without password hash
    const { passwordHash: _, ...userPublic } = user;

    // Create response with HTTP-only cookie
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: userPublic,
        token, // Also return token in body for client-side storage if needed
      },
      { status: 200 }
    );

    // Set HTTP-only cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
