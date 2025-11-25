import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';

/**
 * Auth Layout
 * Minimal layout for login/register pages
 * Redirects to home if user is already authenticated
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

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return false;
  }

  try {
    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const jwtPayload = payload as unknown as JWTPayload;

    if (!jwtPayload.userId) {
      return false;
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
      return false;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.userId },
    });

    if (!user || !user.isActive) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    redirect('/');
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image src="/logo.svg" alt="Logo" width={32} height={32} />
              <h1 className="text-xl font-bold text-zinc-900">Cosmo</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  );
}
