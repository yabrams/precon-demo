import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bcProjectId = formData.get('bcProjectId') as string;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!bcProjectId) {
      return NextResponse.json(
        { error: 'bcProjectId is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.buildingConnectedProject.findUnique({
      where: { id: bcProjectId }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if we have Blob token for production
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    let fileUrl: string;

    if (blobToken) {
      // Use Vercel Blob Storage in production
      const blob = await put(file.name, file, {
        access: 'public',
      });
      fileUrl = blob.url;
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
      fileUrl = `/uploads/${filename}`;
    }

    // Create diagram record in database
    const diagram = await prisma.diagram.create({
      data: {
        bcProjectId,
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: uploadedBy || undefined
      }
    });

    return NextResponse.json({
      diagram,
      // Legacy fields for backward compatibility
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export const runtime = 'nodejs';
