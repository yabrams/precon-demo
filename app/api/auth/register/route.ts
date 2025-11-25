/**
 * User Registration API Route
 * POST /api/auth/register
 * Creates a new user account with hashed password
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { UserRegisterInput } from '@/types/user';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    const body: UserRegisterInput = await request.json();

    // Validate input
    if (!body.email || !body.userName || !body.password) {
      return NextResponse.json(
        { error: 'Email, username, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 chars)
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user with email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if user with username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { userName: body.userName },
    });

    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: body.email,
        userName: body.userName,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        isActive: true,
      },
    });

    // Return user without password hash
    const { passwordHash: _, ...userPublic } = user;

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: userPublic,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
