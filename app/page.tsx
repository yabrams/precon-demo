'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DiagramUpload from '@/components/DiagramUpload';
import WorkspaceView from '@/components/WorkspaceView';
import { LineItem } from '@/components/BidFormTable';

// Extend Window interface for temporary project ID storage
declare global {
  interface Window {
    __newProjectId?: string;
  }
}

interface Project {
  id: string;
  name: string;
  diagramUrl: string;
  lineItems: LineItem[];
  createdAt: number;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [showUpload, setShowUpload] = useState(true);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleUploadSuccess = (file: { url: string; fileName: string }) => {
    // Create new project
    const newProject: Project = {
      id: Date.now().toString(),
      name: file.fileName.replace(/\.[^/.]+$/, ''),
      diagramUrl: file.url,
      lineItems: [],
      createdAt: Date.now(),
    };

    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setShowUpload(false);

    // Store the new project ID for extraction
    window.__newProjectId = newProject.id;
  };

  const handleExtractStart = async (url: string) => {
    setExtracting(true);

    // Get the project ID that was just created
    const projectIdToUpdate = window.__newProjectId || activeProjectId;

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();
      console.log('Received extraction data:', data);
      console.log('Line items received:', data.line_items);
      console.log('Line items length:', data.line_items?.length);
      console.log('Updating project ID:', projectIdToUpdate);

      // Update the correct project with extracted data
      setProjects((prev) => {
        const updated = prev.map((p) =>
          p.id === projectIdToUpdate
            ? {
                ...p,
                name: data.project_name || p.name,
                lineItems: data.line_items || [],
              }
            : p
        );
        console.log('Updated projects:', updated);
        return updated;
      });

      // Clean up the temporary ID
      delete window.__newProjectId;
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract bid data from diagram');
    } finally {
      setExtracting(false);
    }
  };

  const handleLineItemsUpdate = (updatedItems: LineItem[]) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, lineItems: updatedItems } : p
      )
    );
  };

  const handleProjectNameChange = (name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, name } : p))
    );
  };

  const handleUploadNew = () => {
    setShowUpload(true);
  };

  const handleProjectSwitch = (projectId: string) => {
    setActiveProjectId(projectId);
    setShowUpload(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      setShowUpload(remaining.length === 0);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Preconstruction Bidding
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Upload diagrams and extract bid data with AI
              </p>
            </div>

            {/* New Project Button */}
            {!showUpload && projects.length > 0 && (
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + New Project
              </button>
            )}
          </div>
        </div>

        {/* Project Tabs */}
        {projects.length > 0 && (
          <div className="border-t bg-gray-50 px-6">
            <div className="flex gap-2 overflow-x-auto py-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors cursor-pointer flex-shrink-0 ${
                    activeProjectId === project.id
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => handleProjectSwitch(project.id)}
                >
                  <span className="text-sm font-medium truncate max-w-xs">
                    {project.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showUpload ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full flex items-center justify-center p-8"
            >
              <div className="w-full max-w-3xl">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8 text-center"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {projects.length === 0
                      ? 'Get Started'
                      : 'Upload Another Diagram'}
                  </h2>
                  <p className="text-gray-600">
                    Upload a construction diagram to extract bid items automatically
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <DiagramUpload
                    onUploadSuccess={handleUploadSuccess}
                    onExtractStart={handleExtractStart}
                    autoExtract={true}
                  />
                </motion.div>
              </div>
            </motion.div>
          ) : activeProject ? (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <WorkspaceView
                diagramUrl={activeProject.diagramUrl}
                lineItems={activeProject.lineItems}
                projectName={activeProject.name}
                isExtracting={extracting}
                onLineItemsUpdate={handleLineItemsUpdate}
                onProjectNameChange={handleProjectNameChange}
                onUploadNew={handleUploadNew}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}
