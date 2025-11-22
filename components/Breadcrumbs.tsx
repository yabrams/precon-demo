import React from 'react';
import { ChevronRight } from 'lucide-react';

type ViewMode = 'projects' | 'packages' | 'workspace' | 'upload' | 'reviewing' | 'creating' | 'project-review' | 'users';

interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
  isCurrentPage?: boolean;
}

interface BreadcrumbsProps {
  viewMode: ViewMode;
  selectedProject?: {
    name: string;
    projectNumber?: string;
  } | null;
  selectedBidPackage?: {
    name: string;
  } | null;
  onNavigateToProjects: () => void;
  onNavigateToPackages: () => void;
}

export default function Breadcrumbs({
  viewMode,
  selectedProject,
  selectedBidPackage,
  onNavigateToProjects,
  onNavigateToPackages,
}: BreadcrumbsProps) {
  const segments: BreadcrumbSegment[] = [];

  // Build breadcrumb segments based on view mode
  switch (viewMode) {
    case 'projects':
      segments.push({ label: 'Projects', isCurrentPage: true });
      break;

    case 'packages':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({
        label: selectedProject?.name || 'Project',
        isCurrentPage: true
      });
      break;

    case 'workspace':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({
        label: selectedProject?.name || 'Project',
        onClick: onNavigateToPackages
      });
      segments.push({
        label: selectedBidPackage?.name || 'Bid Package',
        isCurrentPage: true
      });
      break;

    case 'upload':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({
        label: selectedProject?.name || 'Project',
        onClick: onNavigateToPackages
      });
      segments.push({ label: 'Upload Diagram', isCurrentPage: true });
      break;

    case 'reviewing':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({
        label: selectedProject?.name || 'Project',
        onClick: onNavigateToPackages
      });
      segments.push({ label: 'Review Document', isCurrentPage: true });
      break;

    case 'creating':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({ label: 'Create New Project', isCurrentPage: true });
      break;

    case 'project-review':
      segments.push({ label: 'Projects', onClick: onNavigateToProjects });
      segments.push({
        label: 'Create New Project',
        onClick: () => {
          // Navigate back to creating view
          onNavigateToProjects();
          // The parent will need to handle setting viewMode to 'creating'
        }
      });
      segments.push({ label: 'Review', isCurrentPage: true });
      break;

    case 'users':
      segments.push({ label: 'Users', isCurrentPage: true });
      break;

    default:
      return null;
  }

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center space-x-1 text-sm">
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          {segment.isCurrentPage ? (
            <span className="text-gray-600 font-medium max-w-[200px] truncate">
              {segment.label}
            </span>
          ) : (
            <button
              onClick={segment.onClick}
              className="text-gray-500 hover:text-zinc-900 transition-colors font-medium max-w-[200px] truncate cursor-pointer"
            >
              {segment.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
