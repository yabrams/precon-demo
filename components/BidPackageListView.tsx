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
            {/* Left Panel: Diagrams */}
            <Panel defaultSize={35} minSize={20} className="bg-white border-r border-gray-200">
              <div className="h-full flex flex-col">
                {/* Diagram Selector */}
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-900">Diagrams</span>
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
            <Panel defaultSize={65} minSize={30} className="bg-gray-50">
              <div className="h-full overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Project Information Card */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Project Information</h3>
                    {isEditMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Project Name</label>
                          <input
                            type="text"
                            defaultValue={project.name}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            defaultValue={project.description || ''}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {project.description && (
                          <div>
                            <span className="text-gray-600">Description:</span>
                            <p className="text-zinc-900 mt-1">{project.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Location & Schedule Card */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Location & Schedule</h3>
                    {isEditMode ? (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                            <input
                              type="text"
                              defaultValue={project.location?.address || ''}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                              <input
                                type="text"
                                defaultValue={project.location?.city || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                              <input
                                type="text"
                                defaultValue={project.location?.state || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Zip Code</label>
                              <input
                                type="text"
                                defaultValue={project.location?.zipCode || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-gray-200 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Bid Due Date</label>
                              <input
                                type="date"
                                defaultValue={project.bidDueDate ? new Date(project.bidDueDate).toISOString().split('T')[0] : ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Budget</label>
                              <input
                                type="number"
                                defaultValue={project.estimatedBudget || ''}
                                placeholder="0.00"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Start Date</label>
                              <input
                                type="date"
                                defaultValue={project.estimatedStartDate ? new Date(project.estimatedStartDate).toISOString().split('T')[0] : ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Completion Date</label>
                              <input
                                type="date"
                                defaultValue={project.estimatedCompletionDate ? new Date(project.estimatedCompletionDate).toISOString().split('T')[0] : ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm text-zinc-900">
                          {project.location?.address && <p className="text-gray-900">{project.location.address}</p>}
                          {(project.location?.city || project.location?.state || project.location?.zipCode) && (
                            <p className="text-gray-600">
                              {[project.location?.city, project.location?.state, project.location?.zipCode]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-gray-200">
                          {project.bidDueDate && (
                            <div>
                              <span className="text-gray-600">Bid Due:</span>
                              <p className="text-zinc-900 mt-1">{formatDate(project.bidDueDate)}</p>
                            </div>
                          )}
                          {project.estimatedBudget && (
                            <div>
                              <span className="text-gray-600">Budget:</span>
                              <p className="text-zinc-900 mt-1">${project.estimatedBudget.toLocaleString()}</p>
                            </div>
                          )}
                          {project.estimatedStartDate && (
                            <div>
                              <span className="text-gray-600">Start:</span>
                              <p className="text-zinc-900 mt-1">{formatDate(project.estimatedStartDate)}</p>
                            </div>
                          )}
                          {project.estimatedCompletionDate && (
                            <div>
                              <span className="text-gray-600">Completion:</span>
                              <p className="text-zinc-900 mt-1">{formatDate(project.estimatedCompletionDate)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Project Details & Team Card */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Project Details & Team</h3>
                    {isEditMode ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Scope of Work</label>
                          <textarea
                            defaultValue={project.scope || ''}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Construction Type</label>
                            <select
                              defaultValue={project.constructionType || ''}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select type...</option>
                              <option value="new">New Construction</option>
                              <option value="renovation">Renovation</option>
                              <option value="addition">Addition</option>
                              <option value="tenant-improvement">Tenant Improvement</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Project Type</label>
                            <select
                              defaultValue={project.projectType || ''}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select type...</option>
                              <option value="commercial">Commercial</option>
                              <option value="residential">Residential</option>
                              <option value="industrial">Industrial</option>
                              <option value="institutional">Institutional</option>
                              <option value="infrastructure">Infrastructure</option>
                            </select>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-gray-200 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
                              <input
                                type="text"
                                defaultValue={project.owner || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Architect</label>
                              <input
                                type="text"
                                defaultValue={project.architect || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Engineer</label>
                              <input
                                type="text"
                                defaultValue={project.engineer || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">General Contractor</label>
                              <input
                                type="text"
                                defaultValue={project.generalContractor || ''}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {project.scope && (
                            <div className="col-span-2">
                              <span className="text-gray-600">Scope:</span>
                              <p className="text-zinc-900 mt-1">{project.scope}</p>
                            </div>
                          )}
                          {project.constructionType && (
                            <div>
                              <span className="text-gray-600">Construction Type:</span>
                              <p className="text-zinc-900 mt-1 capitalize">{project.constructionType}</p>
                            </div>
                          )}
                          {project.projectType && (
                            <div>
                              <span className="text-gray-600">Project Type:</span>
                              <p className="text-zinc-900 mt-1 capitalize">{project.projectType}</p>
                            </div>
                          )}
                        </div>
                        {(project.owner || project.architect || project.engineer || project.generalContractor) && (
                          <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-gray-200">
                            {project.owner && (
                              <div>
                                <span className="text-gray-600">Owner:</span>
                                <p className="text-zinc-900 mt-1">{project.owner}</p>
                              </div>
                            )}
                            {project.architect && (
                              <div>
                                <span className="text-gray-600">Architect:</span>
                                <p className="text-zinc-900 mt-1">{project.architect}</p>
                              </div>
                            )}
                            {project.engineer && (
                              <div>
                                <span className="text-gray-600">Engineer:</span>
                                <p className="text-zinc-900 mt-1">{project.engineer}</p>
                              </div>
                            )}
                            {project.generalContractor && (
                              <div>
                                <span className="text-gray-600">General Contractor:</span>
                                <p className="text-zinc-900 mt-1">{project.generalContractor}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contract Details Card */}
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-zinc-900 mb-3">Contract Details</h3>
                    {isEditMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Contract Type</label>
                          <select
                            defaultValue={project.contractType || ''}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select type...</option>
                            <option value="lump-sum">Lump Sum</option>
                            <option value="cost-plus">Cost Plus</option>
                            <option value="time-and-materials">Time and Materials</option>
                            <option value="unit-price">Unit Price</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bonding Required</label>
                            <select
                              defaultValue={project.bondingRequired ? 'true' : 'false'}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Prevailing Wage</label>
                            <select
                              defaultValue={project.prevailingWage ? 'true' : 'false'}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {project.contractType && (
                          <div>
                            <span className="text-gray-600">Contract Type:</span>
                            <p className="text-zinc-900 mt-1 capitalize">{project.contractType.replace('-', ' ')}</p>
                          </div>
                        )}
                        {project.bondingRequired !== undefined && (
                          <div>
                            <span className="text-gray-600">Bonding Required:</span>
                            <p className="text-zinc-900 mt-1">{project.bondingRequired ? 'Yes' : 'No'}</p>
                          </div>
                        )}
                        {project.prevailingWage !== undefined && (
                          <div>
                            <span className="text-gray-600">Prevailing Wage:</span>
                            <p className="text-zinc-900 mt-1">{project.prevailingWage ? 'Yes' : 'No'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
                        <div className="space-y-3">
                          {bidPackages.map((bidPackage) => (
                            <div
                              key={bidPackage.id}
                              onClick={() => onBidPackageSelect(bidPackage)}
                              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="text-sm font-medium text-zinc-900">{bidPackage.name}</h4>
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                                    bidPackage.status
                                  )}`}
                                >
                                  {bidPackage.status}
                                </span>
                              </div>
                              {bidPackage.description && (
                                <p className="text-xs text-gray-600 mb-2 line-clamp-1">{bidPackage.description}</p>
                              )}
                              {/* Compact Progress Bar */}
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
                <h3 className="text-lg font-medium text-zinc-900 mb-2">No Diagrams Yet</h3>
                <p className="text-gray-600 mb-4">Upload construction diagrams for this project</p>
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
                  <div className="space-y-3">
                    {bidPackages.map((bidPackage) => (
                      <div
                        key={bidPackage.id}
                        onClick={() => onBidPackageSelect(bidPackage)}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-zinc-900">{bidPackage.name}</h4>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                              bidPackage.status
                            )}`}
                          >
                            {bidPackage.status}
                          </span>
                        </div>
                        {bidPackage.description && (
                          <p className="text-sm text-gray-600 mb-3">{bidPackage.description}</p>
                        )}
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
