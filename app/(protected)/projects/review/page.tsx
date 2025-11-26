'use client';

/**
 * Project Review Page
 * /projects/review route - review and approve project before creation
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProjectReviewView from '@/components/ProjectReviewView';
import { BuildingConnectedProject } from '@/types/buildingconnected';

export default function ProjectReviewPage() {
  const router = useRouter();
  const [projectData, setProjectData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load data from sessionStorage
    const storedData = sessionStorage.getItem('projectCreationData');
    if (storedData) {
      try {
        setProjectData(JSON.parse(storedData));
      } catch (e) {
        console.error('Failed to parse project creation data:', e);
        router.push('/projects/new');
      }
    } else {
      // No data - redirect back to creation
      router.push('/projects/new');
    }
    setIsLoading(false);
  }, [router]);

  const handleCancel = () => {
    sessionStorage.removeItem('projectCreationData');
    router.push('/');
  };

  const handleApprove = async (approvedData: any) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedData)
      });

      if (response.ok) {
        const data = await response.json();
        const createdProjectId = data.project?.id;

        // Clear session storage
        sessionStorage.removeItem('projectCreationData');

        // If project has pre-extracted bid packages data, create them
        if (createdProjectId && approvedData.extractedBidPackagesData?.length > 0) {
          for (const extractionResult of approvedData.extractedBidPackagesData) {
            try {
              const extractData = extractionResult.extractionData;
              const diagramId = extractionResult.diagramId;

              if (extractData.bid_packages?.length > 0) {
                for (const pkg of extractData.bid_packages) {
                  if (!pkg.line_items || pkg.line_items.length === 0) continue;

                  await fetch('/api/bid-packages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bcBidPackageId: `${createdProjectId}-${pkg.csi_division}-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                      bcProjectId: createdProjectId,
                      name: pkg.name,
                      description: pkg.description || `${pkg.name} scope of work`,
                      scope: pkg.description,
                      status: 'draft',
                      progress: 0,
                      diagramIds: diagramId ? [diagramId] : [],
                      lineItems: pkg.line_items.map((item: any, index: number) => ({
                        itemNumber: item.item_number || null,
                        description: item.description,
                        quantity: item.quantity || null,
                        unit: item.unit || null,
                        unitPrice: item.unit_price || null,
                        totalPrice: item.total_price || null,
                        notes: item.notes || null,
                        order: index,
                        verified: false,
                        csiCode: item.csiCode || 'N/A',
                        csiTitle: item.csiTitle || 'N/A',
                      }))
                    })
                  });
                }
              }
            } catch (error) {
              console.error('Error creating bid package:', error);
            }
          }
        }

        // Navigate to the project's bid packages
        if (createdProjectId) {
          router.push(`/projects/${createdProjectId}`);
        } else {
          router.push('/');
        }
      } else {
        const error = await response.json();
        console.error('Project creation failed:', error);
        alert(`Failed to create project: ${error.error}`);
      }
    } catch (error) {
      console.error('Project creation error:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  if (isLoading || !projectData) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectReviewView
      mode={projectData.mode}
      platform={projectData.platform}
      uploadedDocuments={projectData.uploadedDocuments}
      selectedExternalProject={projectData.selectedExternalProject}
      initialProjectName={projectData.projectName}
      useMockData={projectData.useMockData}
      onApprove={handleApprove}
      onCancel={handleCancel}
    />
  );
}
