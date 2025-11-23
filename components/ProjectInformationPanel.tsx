'use client';

/**
 * ProjectInformationPanel Component
 * Consolidated view of all project information including:
 * - Basic project details
 * - Location & schedule
 * - Project team
 * - Contract details
 */

import { BuildingConnectedProject } from '@/types/buildingconnected';

interface ProjectInformationPanelProps {
  project: BuildingConnectedProject;
  isEditMode: boolean;
  onUpdateField?: (field: string, value: any) => void;
  onUpdateLocation?: (field: string, value: any) => void;
}

export default function ProjectInformationPanel({
  project,
  isEditMode,
  onUpdateField,
  onUpdateLocation,
}: ProjectInformationPanelProps) {
  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Check if sections have data to display
  const hasLocationScheduleData = !isEditMode && (
    project.location?.address ||
    project.location?.city ||
    project.location?.state ||
    project.location?.zipCode ||
    project.bidDueDate ||
    project.estimatedBudget ||
    project.estimatedStartDate ||
    project.estimatedCompletionDate
  );

  const hasProjectDetailsTeamData = !isEditMode && (
    project.constructionType ||
    project.projectType ||
    project.scope ||
    project.owner ||
    project.architect ||
    project.engineer ||
    project.generalContractor
  );

  const hasContractDetailsData = !isEditMode && (
    project.contractType ||
    project.bondingRequired !== undefined ||
    project.prevailingWage !== undefined
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-zinc-900">Project Information</h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Basic Information */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Basic Information
          </h4>
          {isEditMode ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => onUpdateField?.('name', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project Number
                </label>
                <input
                  type="text"
                  value={project.projectNumber || ''}
                  onChange={(e) => onUpdateField?.('projectNumber', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={project.description || ''}
                  onChange={(e) => onUpdateField?.('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Project description..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 text-xs">Name:</span>
                  <p className="text-zinc-900 font-medium">{project.name}</p>
                </div>
                {project.projectNumber && (
                  <div>
                    <span className="text-gray-600 text-xs">Number:</span>
                    <p className="text-zinc-900 font-mono text-sm">{project.projectNumber}</p>
                  </div>
                )}
              </div>
              {project.description && (
                <div>
                  <span className="text-gray-600 text-xs">Description:</span>
                  <p className="text-zinc-900 text-sm mt-1">{project.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Location & Schedule */}
        {(isEditMode || hasLocationScheduleData) && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Location & Schedule
            </h4>
            {isEditMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={project.location?.address || ''}
                    onChange={(e) => onUpdateLocation?.('address', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={project.location?.city || ''}
                      onChange={(e) => onUpdateLocation?.('city', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={project.location?.state || ''}
                      onChange={(e) => onUpdateLocation?.('state', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Zip</label>
                    <input
                      type="text"
                      value={project.location?.zipCode || ''}
                      onChange={(e) => onUpdateLocation?.('zipCode', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bid Due Date</label>
                  <input
                    type="date"
                    value={
                      project.bidDueDate
                        ? new Date(project.bidDueDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) => onUpdateField?.('bidDueDate', e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Budget</label>
                  <input
                    type="number"
                    value={project.estimatedBudget || ''}
                    onChange={(e) => onUpdateField?.('estimatedBudget', parseFloat(e.target.value) || null)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={
                      project.estimatedStartDate
                        ? new Date(project.estimatedStartDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) => onUpdateField?.('estimatedStartDate', e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Completion Date</label>
                  <input
                    type="date"
                    value={
                      project.estimatedCompletionDate
                        ? new Date(project.estimatedCompletionDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) => onUpdateField?.('estimatedCompletionDate', e.target.value ? new Date(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Location */}
              {(project.location?.address || project.location?.city) && (
                <div className="text-sm">
                  <span className="text-gray-600 text-xs">Location:</span>
                  <div className="mt-1 text-zinc-900">
                    {project.location?.address && <p>{project.location.address}</p>}
                    {(project.location?.city || project.location?.state || project.location?.zipCode) && (
                      <p className="text-gray-700">
                        {[project.location?.city, project.location?.state, project.location?.zipCode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Schedule & Budget Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {project.bidDueDate && (
                  <div>
                    <span className="text-gray-600 text-xs">Bid Due:</span>
                    <p className="text-zinc-900 font-medium">{formatDate(project.bidDueDate)}</p>
                  </div>
                )}
                {project.estimatedBudget && (
                  <div>
                    <span className="text-gray-600 text-xs">Budget:</span>
                    <p className="text-zinc-900 font-medium">${project.estimatedBudget.toLocaleString()}</p>
                  </div>
                )}
                {project.estimatedStartDate && (
                  <div>
                    <span className="text-gray-600 text-xs">Start:</span>
                    <p className="text-zinc-900">{formatDate(project.estimatedStartDate)}</p>
                  </div>
                )}
                {project.estimatedCompletionDate && (
                  <div>
                    <span className="text-gray-600 text-xs">Completion:</span>
                    <p className="text-zinc-900">{formatDate(project.estimatedCompletionDate)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}

        {/* Project Details & Team */}
        {(isEditMode || hasProjectDetailsTeamData) && (
          <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Project Details & Team
          </h4>
          {isEditMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Construction Type</label>
                  <select
                    value={project.constructionType || ''}
                    onChange={(e) => onUpdateField?.('constructionType', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="new">New Construction</option>
                    <option value="renovation">Renovation</option>
                    <option value="addition">Addition</option>
                    <option value="tenant-improvement">Tenant Improvement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Type</label>
                  <select
                    value={project.projectType || ''}
                    onChange={(e) => onUpdateField?.('projectType', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                    <option value="industrial">Industrial</option>
                    <option value="institutional">Institutional</option>
                    <option value="infrastructure">Infrastructure</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Scope of Work</label>
                <textarea
                  value={project.scope || ''}
                  onChange={(e) => onUpdateField?.('scope', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Project scope..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={project.owner || ''}
                    onChange={(e) => onUpdateField?.('owner', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Owner name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Architect</label>
                  <input
                    type="text"
                    value={project.architect || ''}
                    onChange={(e) => onUpdateField?.('architect', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Architect name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Engineer</label>
                  <input
                    type="text"
                    value={project.engineer || ''}
                    onChange={(e) => onUpdateField?.('engineer', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Engineer name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">General Contractor</label>
                  <input
                    type="text"
                    value={project.generalContractor || ''}
                    onChange={(e) => onUpdateField?.('generalContractor', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="GC name"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Project Types */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {project.constructionType && (
                  <div>
                    <span className="text-gray-600 text-xs">Construction Type:</span>
                    <p className="text-zinc-900 capitalize">{project.constructionType.replace('-', ' ')}</p>
                  </div>
                )}
                {project.projectType && (
                  <div>
                    <span className="text-gray-600 text-xs">Project Type:</span>
                    <p className="text-zinc-900 capitalize">{project.projectType}</p>
                  </div>
                )}
              </div>
              {/* Scope */}
              {project.scope && (
                <div className="text-sm">
                  <span className="text-gray-600 text-xs">Scope:</span>
                  <p className="text-zinc-900 mt-1">{project.scope}</p>
                </div>
              )}
              {/* Team Members */}
              {(project.owner || project.architect || project.engineer || project.generalContractor) && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {project.owner && (
                    <div>
                      <span className="text-gray-600 text-xs">Owner:</span>
                      <p className="text-zinc-900">{project.owner}</p>
                    </div>
                  )}
                  {project.architect && (
                    <div>
                      <span className="text-gray-600 text-xs">Architect:</span>
                      <p className="text-zinc-900">{project.architect}</p>
                    </div>
                  )}
                  {project.engineer && (
                    <div>
                      <span className="text-gray-600 text-xs">Engineer:</span>
                      <p className="text-zinc-900">{project.engineer}</p>
                    </div>
                  )}
                  {project.generalContractor && (
                    <div>
                      <span className="text-gray-600 text-xs">General Contractor:</span>
                      <p className="text-zinc-900">{project.generalContractor}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* Contract Details */}
        {(isEditMode || hasContractDetailsData) && (
          <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Contract Details
          </h4>
          {isEditMode ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contract Type</label>
                <select
                  value={project.contractType || ''}
                  onChange={(e) => onUpdateField?.('contractType', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="lump-sum">Lump Sum</option>
                  <option value="cost-plus">Cost Plus</option>
                  <option value="time-and-materials">Time & Materials</option>
                  <option value="unit-price">Unit Price</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bonding Required</label>
                <select
                  value={project.bondingRequired ? 'true' : 'false'}
                  onChange={(e) => onUpdateField?.('bondingRequired', e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prevailing Wage</label>
                <select
                  value={project.prevailingWage ? 'true' : 'false'}
                  onChange={(e) => onUpdateField?.('prevailingWage', e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {project.contractType && (
                <div>
                  <span className="text-gray-600 text-xs">Contract Type:</span>
                  <p className="text-zinc-900 capitalize">{project.contractType.replace('-', ' ')}</p>
                </div>
              )}
              {project.bondingRequired !== undefined && (
                <div>
                  <span className="text-gray-600 text-xs">Bonding:</span>
                  <p className="text-zinc-900">{project.bondingRequired ? 'Required' : 'Not Required'}</p>
                </div>
              )}
              {project.prevailingWage !== undefined && (
                <div>
                  <span className="text-gray-600 text-xs">Prevailing Wage:</span>
                  <p className="text-zinc-900">{project.prevailingWage ? 'Required' : 'Not Required'}</p>
                </div>
              )}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
