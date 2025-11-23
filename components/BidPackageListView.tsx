'use client';

/**
 * Bid Package List View Component
 * Displays bid packages for a selected BuildingConnected project
 */

import { useState, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronDown, ChevronRight, Edit2, Eye } from 'lucide-react';
import { BidPackage } from '@/types/bidPackage';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import ProjectInformationPanel from './ProjectInformationPanel';

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    project.diagrams?.[0]?.id || null
  );
  const imageRef = useRef<HTMLImageElement>(null);

  const currentDiagram = selectedDiagramId
    ? project.diagrams?.find(d => d.id === selectedDiagramId)
    : project.diagrams?.[0];

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

  const getCaptainInitials = (captainName?: string) => {
    if (!captainName) return '?';
    const parts = captainName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
      const name = parts[0];
      return name.length >= 2 ? `${name[0]}${name[name.length - 1]}`.toUpperCase() : name[0].toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-lg font-bold text-zinc-900">{project.name}</h1>
              {project.projectNumber && (
                <p className="text-xs text-gray-600 font-mono">#{project.projectNumber}</p>
              )}
            </div>
          </div>

          {/* Edit/View Mode Toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isEditMode
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isEditMode ? (
              <>
                <Eye className="h-4 w-4" />
                <span>View Mode</span>
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                <span>Edit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content with Panels */}
      <div className="flex-1 min-h-0">
        {project.diagrams && project.diagrams.length > 0 ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Documents */}
            <Panel defaultSize={50} minSize={20} className="bg-white border-r border-gray-200">
              <div className="h-full flex flex-col">
                {/* Diagram Selector */}
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-900">Documents</span>
                    {project.diagrams.length > 1 && (
                      <select
                        value={selectedDiagramId || project.diagrams[0]?.id || ''}
                        onChange={(e) => setSelectedDiagramId(e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-zinc-900 max-w-xs truncate focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                      >
                        {project.diagrams.map((diagram) => (
                          <option key={diagram.id} value={diagram.id}>
                            {diagram.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="file"
                    id="diagram-upload-panel"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                  />
                  <label
                    htmlFor="diagram-upload-panel"
                    className="text-xs px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded cursor-pointer transition-colors"
                  >
                    + Upload
                  </label>
                </div>

                {/* Diagram Viewer */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                  {currentDiagram ? (
                    <img
                      ref={imageRef}
                      src={currentDiagram.fileUrl}
                      alt={currentDiagram.fileName}
                      className="max-w-full h-auto mx-auto object-contain"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                      No diagram selected
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors cursor-col-resize" />

            {/* Right Panel: Project Info */}
            <Panel defaultSize={50} minSize={30} className="bg-gray-50">
              <div className="h-full overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Consolidated Project Information */}
                  <ProjectInformationPanel project={project} isEditMode={isEditMode} />

                  {/* Bid Packages Card */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                      Bid Packages <span className="font-mono text-gray-600">({bidPackages.length})</span>
                    </h3>
                    <div>
                      {bidPackages.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-sm text-gray-600">No bid packages yet</p>
                        </div>
                      ) : isEditMode ? (
                        <div className="space-y-4">
                            {bidPackages.map((bidPackage, index) => (
                              <div
                                key={bidPackage.id}
                                className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700">Package {index + 1}</span>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                                      bidPackage.status
                                    )}`}
                                  >
                                    {bidPackage.status}
                                  </span>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Package Name</label>
                                  <input
                                    type="text"
                                    defaultValue={bidPackage.name}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                  <textarea
                                    defaultValue={bidPackage.description || ''}
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Budget Amount</label>
                                    <input
                                      type="number"
                                      defaultValue={bidPackage.budgetAmount || ''}
                                      placeholder="0.00"
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                      defaultValue={bidPackage.status}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    >
                                      <option value="draft">Draft</option>
                                      <option value="active">Active</option>
                                      <option value="bidding">Bidding</option>
                                      <option value="awarded">Awarded</option>
                                      <option value="closed">Closed</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
                                  <textarea
                                    defaultValue={bidPackage.scope || ''}
                                    rows={2}
                                    placeholder="Detailed scope of work for this package..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Captain Name</label>
                                    <input
                                      type="text"
                                      defaultValue={bidPackage.captainName || ''}
                                      placeholder="Captain name"
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                                    <input
                                      type="text"
                                      defaultValue={bidPackage.location || ''}
                                      placeholder="Package location"
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    />
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-gray-300">
                                  <button
                                    onClick={() => onBidPackageSelect(bidPackage)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    View Package Details →
                                  </button>
                                </div>
                              </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {bidPackages.map((bidPackage) => (
                            <div
                              key={bidPackage.id}
                              onClick={() => onBidPackageSelect(bidPackage)}
                              className="p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 cursor-pointer transition-all bg-white"
                            >
                              {/* Header with Status and Avatar */}
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="text-sm font-semibold text-zinc-900 line-clamp-1 flex-1 pr-2">
                                  {bidPackage.name}
                                </h4>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                                      bidPackage.status
                                    )}`}
                                  >
                                    {bidPackage.status}
                                  </span>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                                    bidPackage.captainName
                                      ? 'bg-zinc-900 text-white'
                                      : 'bg-gray-200 text-gray-500'
                                  }`}>
                                    {getCaptainInitials(bidPackage.captainName)}
                                  </div>
                                </div>
                              </div>

                              {/* Captain Name */}
                              {bidPackage.captainName && (
                                <div className="mb-2">
                                  <span className="text-xs text-gray-500">Captain:</span>
                                  <p className="text-xs font-medium text-zinc-900">{bidPackage.captainName}</p>
                                </div>
                              )}

                              {/* Location */}
                              {bidPackage.location && (
                                <div className="mb-3">
                                  <span className="text-xs text-gray-500">Location:</span>
                                  <p className="text-xs text-zinc-900 line-clamp-1">{bidPackage.location}</p>
                                </div>
                              )}

                              {/* Description */}
                              {bidPackage.description && (
                                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{bidPackage.description}</p>
                              )}

                              {/* Progress Bar */}
                              <div className="flex items-center space-x-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-zinc-900 h-1.5 rounded-full transition-all"
                                    style={{ width: `${bidPackage.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-gray-600">{bidPackage.progress}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          // No diagrams - show simplified view
          <div className="h-full overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              {/* Empty state */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center mb-6">
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
                <h3 className="text-lg font-medium text-zinc-900 mb-2">No Documents Yet</h3>
                <p className="text-gray-600 mb-4">Upload construction documents for this project</p>
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

              {/* Bid Packages in simple view */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">
                  Bid Packages <span className="font-mono text-gray-600">({bidPackages.length})</span>
                </h3>
                {bidPackages.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-8">No bid packages yet</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bidPackages.map((bidPackage) => (
                      <div
                        key={bidPackage.id}
                        onClick={() => onBidPackageSelect(bidPackage)}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer bg-white"
                      >
                        {/* Header with Status and Avatar */}
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="text-sm font-semibold text-zinc-900 line-clamp-1 flex-1 pr-2">
                            {bidPackage.name}
                          </h4>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                                bidPackage.status
                              )}`}
                            >
                              {bidPackage.status}
                            </span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                              bidPackage.captainName
                                ? 'bg-zinc-900 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              {getCaptainInitials(bidPackage.captainName)}
                            </div>
                          </div>
                        </div>

                        {/* Captain Name */}
                        {bidPackage.captainName && (
                          <div className="mb-2">
                            <span className="text-xs text-gray-500">Captain:</span>
                            <p className="text-xs font-medium text-zinc-900">{bidPackage.captainName}</p>
                          </div>
                        )}

                        {/* Location */}
                        {bidPackage.location && (
                          <div className="mb-3">
                            <span className="text-xs text-gray-500">Location:</span>
                            <p className="text-xs text-zinc-900 line-clamp-1">{bidPackage.location}</p>
                          </div>
                        )}

                        {/* Description */}
                        {bidPackage.description && (
                          <p className="text-xs text-gray-600 mb-3 line-clamp-2">{bidPackage.description}</p>
                        )}

                        {/* Progress Bar */}
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-zinc-900 h-2 rounded-full transition-all"
                              style={{ width: `${bidPackage.progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-mono text-gray-600">{bidPackage.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
