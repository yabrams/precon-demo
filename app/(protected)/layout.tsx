import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';
import { AuthProvider } from '@/lib/auth-context';
import ProtectedLayoutClient from './ProtectedLayoutClient';

/**
 * Protected Layout
 * Server component that handles authentication and wraps the protected routes
 */

const prisma = new PrismaClient();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

interface JWTPayload {
  userId: string;
  email: string;
  userName: string;
  role: string;
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  try {
    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const jwtPayload = payload as unknown as JWTPayload;

    if (!jwtPayload.userId) {
      return null;
    }

    // Check if session exists and is valid
    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.session.delete({ where: { token } }).catch(() => {});
      }
      return null;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Return user without password hash
    const { passwordHash: _, ...userPublic } = user;
    return userPublic;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayoutClient user={user}>
        {children}
      </ProtectedLayoutClient>
    </AuthProvider>
  );
}
