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
        return 'bg-zinc-50 text-zinc-800 border-zinc-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'awarded':
        return 'bg-zinc-50 text-zinc-800 border-zinc-200';
      case 'closed':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'draft':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
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
    <div className="h-full bg-gray-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-gray-600 hover:text-zinc-900 mb-3 transition-colors"
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
          <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
          {project.projectNumber && (
            <p className="text-sm text-gray-600 mt-1 font-mono">#{project.projectNumber}</p>
          )}
          {project.location && (project.location.city || project.location.state) && (
            <p className="text-sm text-gray-600 mt-2">
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
            <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-zinc-900">
                  Project Diagrams <span className="font-mono text-gray-600">({project.diagrams.length})</span>
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
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg shadow-md shadow-zinc-900/10 transition-colors flex items-center cursor-pointer"
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
                    className="flex items-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                  >
                    <svg
                      className="h-8 w-8 text-gray-500 mr-3 flex-shrink-0"
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
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {diagram.fileName}
                      </p>
                      <p className="text-xs text-gray-600">
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
            <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
              <div className="text-gray-500 mb-4">
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
              <h3 className="text-lg font-medium text-zinc-900 mb-2">No Diagrams Yet</h3>
              <p className="text-gray-600 mb-4">
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
                className="inline-flex items-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-md shadow-zinc-900/10 transition-colors cursor-pointer"
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
            <h2 className="text-lg font-semibold text-zinc-900">
              Bid Packages <span className="font-mono text-gray-600">({bidPackages.length})</span>
            </h2>
          </div>

          {bidPackages.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center">
              <div className="text-gray-500 mb-4">
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
              <h3 className="text-lg font-medium text-zinc-900 mb-2">No Bid Packages</h3>
              <p className="text-gray-600">This project doesn't have any bid packages yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bidPackages.map((bidPackage) => (
                <div
                  key={bidPackage.id}
                  onClick={() => onBidPackageSelect(bidPackage)}
                  className="bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all cursor-pointer overflow-hidden"
                >
                  <div className="p-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-zinc-900 text-lg mb-2">
                          {bidPackage.name}
                        </h3>
                        {bidPackage.description && (
                          <p className="text-sm text-gray-600 mb-3">
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
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span className="font-medium font-mono">{bidPackage.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-zinc-900 h-2 rounded-full transition-all"
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
                            className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0"
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
                          <span className="text-sm text-gray-600">
                            Due: <span className="font-mono">{formatDate(bidPackage.bidDueDate)}</span>
                          </span>
                        </div>
                      )}

                      {/* Scope */}
                      {bidPackage.scope && (
                        <div className="flex items-start">
                          <svg
                            className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5"
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
                          <span className="text-sm text-gray-600 line-clamp-2">
                            {bidPackage.scope}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button className="text-sm font-medium text-zinc-900 hover:text-zinc-800 flex items-center transition-colors">
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
