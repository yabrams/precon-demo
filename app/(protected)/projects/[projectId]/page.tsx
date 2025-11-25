'use client';

/**
 * Project Bid Packages Page
 * /projects/:projectId route - displays bid packages for a project
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import BidPackageListView from '@/components/BidPackageListView';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectBidPackagesPage({ params }: PageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<BuildingConnectedProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else if (response.status === 404) {
        setError('Project not found');
      } else {
        setError('Failed to load project');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      setError('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBidPackageSelect = (bidPackage: BidPackage) => {
    router.push(`/projects/${projectId}/packages/${bidPackage.id}`);
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleUploadDiagrams = () => {
    router.push(`/projects/${projectId}/upload`);
  };

  const handleUploadSuccess = async (file: any) => {
    // Reload project to get updated diagrams
    await loadProject();
    // Navigate to review diagram page
    if (file.diagram) {
      router.push(`/projects/${projectId}/review-diagram?diagramId=${file.diagram.id}`);
    }
  };

  const handleProjectUpdate = (updatedProject: BuildingConnectedProject, updatedBidPackages: BidPackage[]) => {
    setProject({ ...updatedProject, bidPackages: updatedBidPackages });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">{error || 'Project not found'}</h2>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <BidPackageListView
      project={project}
      bidPackages={project.bidPackages || []}
      onBidPackageSelect={handleBidPackageSelect}
      onBack={handleBack}
      onUploadDiagrams={handleUploadDiagrams}
      onUploadSuccess={handleUploadSuccess}
      onProjectUpdate={handleProjectUpdate}
      onSaveComplete={loadProject}
    />
  );
}
