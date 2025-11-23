import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Calculate hash from buffer
 */
export function calculateBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if a file with the given hash already exists
 */
export async function checkDuplicateFile(fileHash: string) {
  const existingDiagram = await prisma.diagram.findFirst({
    where: { fileHash },
    include: {
      bcProject: true,
      project: true,
    }
  });

  return existingDiagram;
}

/**
 * Generate a copy number for duplicate projects
 * e.g., "Project Name" -> "COPY 1 Project Name"
 * e.g., "COPY 1 Project Name" -> "COPY 2 Project Name"
 */
export function generateCopyName(originalName: string, existingNames: string[]): string {
  // Pattern to match "COPY X" prefix
  const copyPattern = /^COPY (\d+) (.+)$/;

  // Extract base name (removing any existing COPY prefix)
  let baseName = originalName;
  const match = originalName.match(copyPattern);
  if (match) {
    baseName = match[2];
  }

  // Find all existing copy numbers for this base name
  const copyNumbers: number[] = [];
  existingNames.forEach(name => {
    if (name === baseName) {
      copyNumbers.push(0); // Original exists
    }
    const copyMatch = name.match(copyPattern);
    if (copyMatch && copyMatch[2] === baseName) {
      copyNumbers.push(parseInt(copyMatch[1]));
    }
  });

  // If no copies exist, this is the first copy
  if (copyNumbers.length === 0) {
    return baseName; // No duplicates, use original name
  }

  // Find the next available copy number
  const maxCopyNumber = Math.max(...copyNumbers);
  const nextCopyNumber = maxCopyNumber + 1;

  return `COPY ${nextCopyNumber} ${baseName}`;
}

/**
 * Process multiple files and detect duplicates
 */
export interface FileProcessingResult {
  fileName: string;
  fileHash: string;
  isDuplicate: boolean;
  existingProjectId?: string;
  existingProjectName?: string;
  suggestedProjectName?: string;
}

export async function processFilesForDuplicates(
  files: Array<{ path: string; name: string }>
): Promise<FileProcessingResult[]> {
  const results: FileProcessingResult[] = [];

  // Get all existing project names for copy numbering
  const existingProjects = await prisma.buildingConnectedProject.findMany({
    select: { name: true }
  });
  const existingProjectNames = existingProjects.map(p => p.name);

  for (const file of files) {
    const fileHash = await calculateFileHash(file.path);
    const duplicate = await checkDuplicateFile(fileHash);

    if (duplicate) {
      // File is a duplicate
      const existingProject = duplicate.bcProject || duplicate.project;
      const existingProjectName = duplicate.bcProject?.name || duplicate.project?.name || 'Unknown';

      results.push({
        fileName: file.name,
        fileHash,
        isDuplicate: true,
        existingProjectId: duplicate.bcProjectId || duplicate.projectId || undefined,
        existingProjectName,
        suggestedProjectName: generateCopyName(existingProjectName, existingProjectNames)
      });
    } else {
      // New file
      results.push({
        fileName: file.name,
        fileHash,
        isDuplicate: false
      });
    }
  }

  return results;
}