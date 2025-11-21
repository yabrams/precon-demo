'use client';

/**
 * Bid Package List View Component
 * Displays bid packages for a selected BuildingConnected project
 */

import { BidPackage } from '@/types/bidPackage';
import { BuildingConnectedProject } from '@/types/buildingconnected';

interface UploadedFile {
  url: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

interface BidPackageListViewProps {
  project: BuildingConnectedProject;
  bidPackages: BidPackage[];
  onBidPackageSelect: (bidPackage: BidPackage) => void;
  onBack: () => void;
  onUploadDiagrams?: () => void;
  onUploadSuccess?: (file: UploadedFile) => void;
}

export default function BidPackageListView({
  project,
  bidPackages,
  onBidPackageSelect,
  onBack,
  onUploadDiagrams,
  onUploadSuccess,
}: BidPackageListViewProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bidding':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'awarded':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'closed':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'draft':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
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

  // Direct file upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bcProjectId', project.id);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadedData = await uploadResponse.json();

      // Pass uploaded file data to parent component
      if (onUploadSuccess) {
        onUploadSuccess(uploadedData);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    }

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  return (
    <div className="h-full bg-slate-950 overflow-auto">
      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-slate-400 hover:text-white mb-3 transition-colors"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Projects
        </button>

        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.projectNumber && (
            <p className="text-sm text-slate-400 mt-1 font-mono">#{project.projectNumber}</p>
          )}
          {project.location && (project.location.city || project.location.state) && (
            <p className="text-sm text-slate-400 mt-2">
              📍{' '}
              {[project.location.city, project.location.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Bid Packages */}
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          {/* Project Diagrams Section */}
          {project.diagrams && project.diagrams.length > 0 && (
            <div className="mb-8 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-white">
                  Project Diagrams <span className="font-mono text-slate-400">({project.diagrams.length})</span>
                </h3>
                {onUploadDiagrams && (
                  <>
                    <input
                      type="file"
                      id="diagram-upload-existing"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={handleFileSelect}
                    />
                    <label
                      htmlFor="diagram-upload-existing"
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-violet-900/20 transition-colors flex items-center cursor-pointer"
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Upload Diagram
                    </label>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {project.diagrams.map((diagram) => (
                  <div
                    key={diagram.id}
                    className="flex items-center p-3 border border-slate-800 rounded-xl hover:bg-slate-800/60 hover:backdrop-blur-md transition-all"
                  >
                    <svg
                      className="h-8 w-8 text-slate-400 mr-3 flex-shrink-0"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {diagram.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {diagram.category || 'Diagram'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for diagrams */}
          {(!project.diagrams || project.diagrams.length === 0) && onUploadDiagrams && (
            <div className="mb-8 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center">
              <div className="text-slate-400 mb-4">
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
              <h3 className="text-lg font-medium text-white mb-2">No Diagrams Yet</h3>
              <p className="text-slate-400 mb-4">
                Upload construction diagrams for this project
              </p>
              <input
                type="file"
                id="diagram-upload-empty"
                className="hidden"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="diagram-upload-empty"
                className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg shadow-lg shadow-violet-900/20 transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload First Diagram
              </label>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">
              Bid Packages <span className="font-mono text-slate-400">({bidPackages.length})</span>
            </h2>
          </div>

          {bidPackages.length === 0 ? (
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center">
              <div className="text-slate-400 mb-4">
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
              <h3 className="text-lg font-medium text-white mb-2">No Bid Packages</h3>
              <p className="text-slate-400">This project doesn't have any bid packages yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bidPackages.map((bidPackage) => (
                <div
                  key={bidPackage.id}
                  onClick={() => onBidPackageSelect(bidPackage)}
                  className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl hover:bg-slate-800/60 hover:shadow-xl hover:shadow-violet-900/10 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg mb-2">
                          {bidPackage.name}
                        </h3>
                        {bidPackage.description && (
                          <p className="text-sm text-slate-400 mb-3">
                            {bidPackage.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full border ml-4 ${getStatusColor(
                          bidPackage.status
                        )}`}
                      >
                        {bidPackage.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                        <span>Progress</span>
                        <span className="font-medium font-mono">{bidPackage.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-cyan-600 h-2 rounded-full transition-all"
                          style={{ width: `${bidPackage.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Bid Due Date */}
                      {bidPackage.bidDueDate && (
                        <div className="flex items-center">
                          <svg
                            className="h-5 w-5 text-slate-400 mr-2 flex-shrink-0"
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
                            Due: <span className="font-mono">{formatDate(bidPackage.bidDueDate)}</span>
                          </span>
                        </div>
                      )}

                      {/* Scope */}
                      {bidPackage.scope && (
                        <div className="flex items-start">
                          <svg
                            className="h-5 w-5 text-slate-400 mr-2 flex-shrink-0 mt-0.5"
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
                          <span className="text-sm text-slate-400 line-clamp-2">
                            {bidPackage.scope}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      <button className="text-sm font-medium text-violet-400 hover:text-violet-300 flex items-center transition-colors">
                        View Details
                        <svg
                          className="h-4 w-4 ml-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
