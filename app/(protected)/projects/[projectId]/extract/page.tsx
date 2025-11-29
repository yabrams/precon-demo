'use client';

/**
 * Advanced Extraction Page
 * /projects/[projectId]/extract route - Extract work packages from project documents
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, FileText, AlertCircle, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ExtractionSession } from '@/lib/extraction/types';

// Dynamically import ExtractionContainer to avoid SSR issues
const ExtractionContainer = dynamic(() => import('@/components/ExtractionContainer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  ),
});

interface ProjectDiagram {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

interface ProjectData {
  id: string;
  name: string;
  diagrams: ProjectDiagram[];
}

export default function ExtractPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiagramIds, setSelectedDiagramIds] = useState<string[]>([]);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error('Failed to load project');
        }
        const data = await response.json();
        setProject(data.project);

        // Select all diagrams by default
        if (data.project?.diagrams) {
          setSelectedDiagramIds(data.project.diagrams.map((d: ProjectDiagram) => d.id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const handleBack = () => {
    router.push(`/projects/${projectId}`);
  };

  const handleComplete = (session: ExtractionSession) => {
    // Navigate to project page to see extracted packages
    router.push(`/projects/${projectId}?extraction=${session.id}`);
  };

  const toggleDiagramSelection = (diagramId: string) => {
    setSelectedDiagramIds((prev) =>
      prev.includes(diagramId)
        ? prev.filter((id) => id !== diagramId)
        : [...prev, diagramId]
    );
  };

  const selectAllDiagrams = () => {
    if (project?.diagrams) {
      setSelectedDiagramIds(project.diagrams.map((d) => d.id));
    }
  };

  const deselectAllDiagrams = () => {
    setSelectedDiagramIds([]);
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Project</h2>
          <p className="text-gray-600 mb-6">{error || 'Project not found'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // No diagrams
  if (!project.diagrams || project.diagrams.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to project"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Extract Work Packages</h1>
              <p className="text-sm text-gray-500">{project.name}</p>
            </div>
          </div>
        </div>

        {/* No documents message */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Documents</h2>
            <p className="text-gray-600 mb-6">
              Upload documents to this project before running extraction.
            </p>
            <button
              onClick={() => router.push(`/projects/${projectId}/upload`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to project"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Extract Work Packages</h1>
              <p className="text-sm text-gray-500">{project.name}</p>
            </div>
          </div>

          {/* Document selection info */}
          <div className="text-sm text-gray-500">
            {selectedDiagramIds.length} of {project.diagrams.length} documents selected
          </div>
        </div>
      </div>

      {/* Document selection panel (collapsible) */}
      {project.diagrams.length > 1 && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Select Documents</span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllDiagrams}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAllDiagrams}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {project.diagrams.map((diagram) => (
              <button
                key={diagram.id}
                onClick={() => toggleDiagramSelection(diagram.id)}
                className={`
                  inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${
                    selectedDiagramIds.includes(diagram.id)
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <FileText className="h-4 w-4" />
                <span className="truncate max-w-[200px]">{diagram.fileName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extraction container */}
      <div className="flex-1 overflow-hidden">
        {selectedDiagramIds.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Select at least one document to extract.</p>
            </div>
          </div>
        ) : (
          <ExtractionContainer
            projectId={projectId}
            documentIds={selectedDiagramIds}
            onComplete={handleComplete}
            onClose={handleBack}
          />
        )}
      </div>
    </div>
  );
}
