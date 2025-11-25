'use client';

/**
 * Upload Diagram Page
 * /projects/:projectId/upload route - upload diagrams to a project
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import DiagramUpload from '@/components/DiagramUpload';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function UploadDiagramPage({ params }: PageProps) {
  const { projectId } = use(params);
  const router = useRouter();

  const handleCancel = () => {
    router.push(`/projects/${projectId}`);
  };

  const handleUploadSuccess = (file: any) => {
    // Store the uploaded diagram info for the review page
    if (file.diagram) {
      sessionStorage.setItem('pendingDiagram', JSON.stringify(file.diagram));
      router.push(`/projects/${projectId}/review-diagram?diagramId=${file.diagram.id}`);
    }
  };

  const handleExtractStart = async (url: string, instructions?: string) => {
    // Trigger extraction
    try {
      const response = await fetch('/api/extract-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: url,
          instructions,
          projectId,
        }),
      });

      if (response.ok) {
        router.push(`/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Extraction error:', error);
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <DiagramUpload
        bcProjectId={projectId}
        onUploadSuccess={handleUploadSuccess}
        onExtractStart={handleExtractStart}
        onCancel={handleCancel}
      />
    </div>
  );
}
