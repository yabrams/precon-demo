import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    let avatarUrl: string;

    // Check if we have Blob token for production
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      // Use Vercel Blob Storage in production
      const blob = await put(`avatars/${user.id}-${file.name}`, file, {
        access: 'public',
      });
      avatarUrl = blob.url;
    } else {
      // Use local file system for development
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create avatars directory if it doesn't exist
      const avatarDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
      await mkdir(avatarDir, { recursive: true });

      // Generate unique filename with user ID
      const fileExtension = file.name.split('.').pop();
      const filename = `${user.id}-${Date.now()}.${fileExtension}`;
      const filepath = path.join(avatarDir, filename);

      // Write file to disk
      await writeFile(filepath, buffer);

      // Return local URL
      avatarUrl = `/uploads/avatars/${filename}`;
    }

    // Update user's avatar URL in database
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });

    return NextResponse.json({
      avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
