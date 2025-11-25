import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  calculateFileHash,
  calculateBufferHash,
  checkDuplicateFile,
  generateCopyName
} from '@/lib/file-utils';

interface UploadResult {
  diagram?: any;
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash: string;
  isDuplicate?: boolean;
  existingProjectId?: string;
  existingProjectName?: string;
  suggestedProjectName?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const bcProjectId = formData.get('bcProjectId') as string;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // If bcProjectId provided, verify project exists
    if (bcProjectId) {
      const project = await prisma.buildingConnectedProject.findUnique({
        where: { id: bcProjectId }
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    }

    const results: UploadResult[] = [];
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    // Get all existing project names for copy numbering
    const existingProjects = await prisma.buildingConnectedProject.findMany({
      select: { id: true, name: true }
    });
    const existingProjectNames = existingProjects.map(p => p.name);

    // Process each file
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Calculate file hash
      const fileHash = calculateBufferHash(buffer);

      // Check for duplicates
      const existingDiagram = await checkDuplicateFile(fileHash);

      if (existingDiagram) {
        // File is a duplicate
        const existingProject = existingDiagram.bcProject || existingDiagram.project;
        const existingProjectName = existingDiagram.bcProject?.name || existingDiagram.project?.name || 'Unknown';
        const suggestedName = generateCopyName(existingProjectName, existingProjectNames);

        // Add the suggested name to the list for next iterations
        existingProjectNames.push(suggestedName);

        results.push({
          url: existingDiagram.fileUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileHash,
          isDuplicate: true,
          existingProjectId: existingDiagram.bcProjectId || existingDiagram.projectId || undefined,
          existingProjectName,
          suggestedProjectName: suggestedName,
          diagram: existingDiagram
        });
        continue; // Skip uploading duplicate file
      }

      // Not a duplicate, proceed with upload
      let fileUrl: string;

      if (blobToken) {
        // Use Vercel Blob Storage in production
        const blob = await put(file.name, file, {
          access: 'public',
        });
        fileUrl = blob.url;
      } else {
        // Use local file system for development
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

      // Create diagram record in database if bcProjectId provided
      let diagram = null;
      if (bcProjectId) {
        diagram = await prisma.diagram.create({
          data: {
            bcProjectId,
            fileName: file.name,
            fileUrl,
            fileType: file.type,
            fileSize: file.size,
            fileHash, // Store the hash
            uploadedBy: uploadedBy || undefined
          }
        });
      }

      results.push({
        diagram,
        url: fileUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileHash,
        isDuplicate: false
      });
    }

    // Return single result for backward compatibility if only one file
    if (results.length === 1) {
      return NextResponse.json(results[0]);
    }

    // Return array of results for multiple files
    return NextResponse.json({ files: results });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file(s)' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';