'use client';

/**
 * Projects List Page
 * / route - displays all projects
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BuildingConnectedProjectList from '@/components/BuildingConnectedProjectList';
import { BuildingConnectedProject } from '@/types/buildingconnected';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<BuildingConnectedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSelect = (project: BuildingConnectedProject) => {
    router.push(`/projects/${project.id}`);
  };

  const handleNewProject = () => {
    router.push('/projects/new');
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <BuildingConnectedProjectList
      projects={projects}
      onProjectSelect={handleProjectSelect}
      onNewProject={handleNewProject}
    />
  );
}
