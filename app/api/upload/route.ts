import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if we have Blob token for production
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      // Use Vercel Blob Storage in production
      const blob = await put(file.name, file, {
        access: 'public',
      });

      return NextResponse.json({
        url: blob.url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
    } else {
      // Use local file system for development
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create uploads directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const filename = `${uniqueSuffix}-${file.name}`;
      const filepath = path.join(uploadDir, filename);

      // Write file to disk
      await writeFile(filepath, buffer);

      // Return local URL
      const url = `/uploads/${filename}`;

      return NextResponse.json({
        url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
