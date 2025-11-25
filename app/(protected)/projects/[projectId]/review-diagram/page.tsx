'use client';

/**
 * Review Diagram Page
 * /projects/:projectId/review-diagram route - review and categorize uploaded diagram
 */

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentReviewView from '@/components/DocumentReviewView';

interface Diagram {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

interface Categorization {
  category: string;
  confidence: number;
  reasoning: string;
  alternativeCategories: string[];
}

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function ReviewDiagramPage({ params }: PageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagramId = searchParams.get('diagramId');

  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [categorization, setCategorization] = useState<Categorization | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    loadDiagram();
  }, [diagramId]);

  const loadDiagram = async () => {
    // First try sessionStorage
    const storedDiagram = sessionStorage.getItem('pendingDiagram');
    if (storedDiagram) {
      try {
        const parsed = JSON.parse(storedDiagram);
        setDiagram(parsed);
        await categorizeDiagram(parsed);
        return;
      } catch (e) {
        console.error('Failed to parse stored diagram:', e);
      }
    }

    // Fall back to fetching from API
    if (diagramId) {
      try {
        const response = await fetch(`/api/diagrams/${diagramId}`);
        if (response.ok) {
          const data = await response.json();
          setDiagram(data.diagram);
          await categorizeDiagram(data.diagram);
        } else {
          router.push(`/projects/${projectId}`);
        }
      } catch (error) {
        console.error('Failed to load diagram:', error);
        router.push(`/projects/${projectId}`);
      }
    } else {
      router.push(`/projects/${projectId}`);
    }
  };

  const categorizeDiagram = async (diagramData: Diagram) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/categorize-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: diagramData.fileUrl,
          fileName: diagramData.fileName,
          fileType: diagramData.fileType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCategorization(result);
      }
    } catch (error) {
      console.error('Categorization error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async (selectedCategory: string) => {
    if (!diagram) return;

    setIsConfirming(true);

    try {
      // Create or find bid package for this category
      const bcBidPackageId = `${projectId}-${selectedCategory.replace(/\s+/g, '-').toLowerCase()}`;

      // Check if bid package exists
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      let bidPackage = projectData.project?.bidPackages?.find(
        (bp: any) => bp.name === selectedCategory
      );

      if (!bidPackage) {
        // Create new bid package
        const createResponse = await fetch('/api/bid-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bcBidPackageId,
            bcProjectId: projectId,
            name: selectedCategory,
            description: `Bid package for ${selectedCategory}`,
            status: 'draft',
            progress: 0,
            diagramIds: [diagram.id],
          }),
        });

        if (createResponse.ok) {
          const { bidPackage: newBidPackage } = await createResponse.json();
          bidPackage = newBidPackage;
        }
      } else {
        // Update existing bid package to include this diagram
        const existingDiagramIds = bidPackage.diagramIds
          ? JSON.parse(bidPackage.diagramIds)
          : [];
        if (!existingDiagramIds.includes(diagram.id)) {
          existingDiagramIds.push(diagram.id);

          await fetch(`/api/bid-packages/${bidPackage.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              diagramIds: existingDiagramIds,
            }),
          });
        }
      }

      // Trigger extraction for this diagram
      await fetch('/api/extract-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: diagram.fileUrl,
          projectId,
          diagramId: diagram.id,
        }),
      });

      // Clear session storage and navigate back
      sessionStorage.removeItem('pendingDiagram');
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error confirming category:', error);
      alert('Failed to process document category. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('pendingDiagram');
    router.push(`/projects/${projectId}`);
  };

  if (!diagram) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading diagram...</p>
        </div>
      </div>
    );
  }

  return (
    <DocumentReviewView
      diagram={diagram}
      categorization={categorization}
      isProcessing={isProcessing || isConfirming}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
