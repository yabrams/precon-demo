'use client';

/**
 * BuildingConnected Project List Component
 * Displays all BuildingConnected projects in a card-based grid layout
 */

import { BuildingConnectedProject } from '@/types/buildingconnected';
import { formatDistanceToNow } from 'date-fns';

interface BuildingConnectedProjectListProps {
  projects: BuildingConnectedProject[];
  onProjectSelect: (project: BuildingConnectedProject) => void;
}

export default function BuildingConnectedProjectList({
  projects,
  onProjectSelect,
}: BuildingConnectedProjectListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bidding':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'awarded':
        return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
      case 'closed':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      case 'archived':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilBid = (bidDueDate?: Date) => {
    if (!bidDueDate) return null;
    const dateObj = typeof bidDueDate === 'string' ? new Date(bidDueDate) : bidDueDate;
    const now = new Date();
    const diffTime = dateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="h-full bg-slate-950 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">BuildingConnected Projects</h1>
          <p className="text-slate-400 mt-2">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-sm p-12 text-center">
            <div className="text-slate-500 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-50 mb-2">No Projects Yet</h3>
            <p className="text-slate-500">
              Projects from BuildingConnected will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const daysUntilBid = getDaysUntilBid(project.bidDueDate);

              return (
                <div
                  key={project.id}
                  onClick={() => onProjectSelect(project)}
                  className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-900/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  {/* Project Header */}
                  <div className="p-5 border-b border-slate-800">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white text-lg leading-tight flex-1 pr-2">
                        {project.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status}
                      </span>
                    </div>

                    {project.projectNumber && (
                      <p className="text-sm text-slate-500 mb-3 font-mono">#{project.projectNumber}</p>
                    )}

                    {project.description && (
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Project Details */}
                  <div className="p-5 space-y-3">
                    {/* Location */}
                    {project.location && (project.location.city || project.location.state) && (
                      <div className="flex items-start">
                        <svg
                          className="h-5 w-5 text-slate-500 mr-2 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-sm text-slate-400">
                          {[project.location.city, project.location.state]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Market Sector */}
                    {project.marketSector && (
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-slate-500 mr-2 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <span className="text-sm text-slate-400">{project.marketSector}</span>
                      </div>
                    )}

                    {/* Project Value */}
                    {project.projectValue && (
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-slate-500 mr-2 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-white font-mono">
                          {formatCurrency(project.projectValue)}
                        </span>
                      </div>
                    )}

                    {/* Bid Due Date */}
                    {project.bidDueDate && (
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-slate-500 mr-2 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-slate-400">
                          Bid Due: <span className="font-mono">{formatDate(project.bidDueDate)}</span>
                          {daysUntilBid !== null && (
                            <span
                              className={`ml-2 font-medium ${
                                daysUntilBid < 7
                                  ? 'text-red-400'
                                  : daysUntilBid < 14
                                  ? 'text-orange-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              ({daysUntilBid} {daysUntilBid === 1 ? 'day' : 'days'})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Project Footer */}
                  <div className="px-5 py-3 bg-slate-900/40 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      {project.client && <span>{project.client}</span>}
                      {project.updatedAt && (
                        <span className="font-mono">
                          Updated{' '}
                          {formatDistanceToNow(
                            typeof project.updatedAt === 'string'
                              ? new Date(project.updatedAt)
                              : project.updatedAt,
                            { addSuffix: true }
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
