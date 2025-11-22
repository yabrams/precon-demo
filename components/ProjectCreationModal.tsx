/**
 * ProjectCreationModal Component
 * Modal for creating new projects - supports manual creation and BC import
 */

'use client';

import { useState, useRef } from 'react';
import { X, Upload, ChevronDown } from 'lucide-react';

interface UploadedDocument {
  fileName: string;
  url: string;
  fileSize: number;
  fileType: string;
}

interface BCProject {
  bcProjectId: string;
  name: string;
  projectNumber?: string;
  description?: string;
  status: string;
  bidDueDate?: Date;
  location?: {
    address?: string;
    city?: string;
    state?: string;
  };
}

interface ProjectCreationModalProps {
  onClose: () => void;
  onContinue: (data: {
    mode: 'manual' | 'bc-import';
    uploadedDocuments: UploadedDocument[];
    selectedBCProject?: BCProject;
  }) => void;
}

export default function ProjectCreationModal({
  onClose,
  onContinue
}: ProjectCreationModalProps) {
  const [loadFromBC, setLoadFromBC] = useState(false);
  const [selectedBCProject, setSelectedBCProject] = useState<BCProject | null>(null);
  const [bcProjects, setBCProjects] = useState<BCProject[]>([]);
  const [loadingBCProjects, setLoadingBCProjects] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load BC projects when toggle is enabled
  const handleToggleBC = async (enabled: boolean) => {
    setLoadFromBC(enabled);
    
    if (enabled && bcProjects.length === 0) {
      setLoadingBCProjects(true);
      try {
        const response = await fetch('/api/buildingconnected/projects');
        const data = await response.json();
        if (data.success) {
          setBCProjects(data.projects);
        }
      } catch (error) {
        console.error('Failed to load BC projects:', error);
      } finally {
        setLoadingBCProjects(false);
      }
    }
  };

  // Handle file selection
  const handleFiles = async (files: FileList) => {
    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        return {
          fileName: data.fileName,
          url: data.url,
          fileSize: data.fileSize,
          fileType: data.fileType
        };
      });
      
      const uploaded = await Promise.all(uploadPromises);
      setUploadedDocuments(prev => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (uploadedDocuments.length === 0) {
      alert('Please upload at least one document');
      return;
    }
    
    if (loadFromBC && !selectedBCProject) {
      alert('Please select a BuildingConnected project');
      return;
    }
    
    onContinue({
      mode: loadFromBC ? 'bc-import' : 'manual',
      uploadedDocuments,
      selectedBCProject: selectedBCProject || undefined
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900 mb-1">
                  Load from BuildingConnected
                </h3>
                <p className="text-sm text-gray-600">
                  Import project details from an existing BuildingConnected project
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadFromBC}
                  onChange={(e) => handleToggleBC(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {loadFromBC && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select BuildingConnected Project
              </label>
              {loadingBCProjects ? (
                <div className="border border-gray-300 rounded-lg p-4 text-center text-gray-500">
                  Loading projects...
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedBCProject?.bcProjectId || ''}
                    onChange={(e) => {
                      const project = bcProjects.find(p => p.bcProjectId === e.target.value);
                      setSelectedBCProject(project || null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a project...</option>
                    {bcProjects.map((project) => (
                      <option key={project.bcProjectId} value={project.bcProjectId}>
                        {project.name} {project.projectNumber ? `(project.projectNumber)` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              )}
              
              {selectedBCProject && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Status:</span> {selectedBCProject.status}</p>
                    {selectedBCProject.description && (
                      <p><span className="font-medium">Description:</span> {selectedBCProject.description}</p>
                    )}
                    {selectedBCProject.location && (
                      <p><span className="font-medium">Location:</span> {selectedBCProject.location.city}, {selectedBCProject.location.state}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Documents
            </label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              
              {uploading ? (
                <div>
                  <p className="text-gray-600 font-medium mb-2">Uploading...</p>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mx-auto">
                    <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/5"></div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 font-medium mb-2">
                    Drop files here or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports PDF, JPG, PNG
                  </p>
                </div>
              )}
            </div>

            {uploadedDocuments.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-xs">
                            {doc.fileType.split('/')[1]?.toUpperCase().slice(0, 3)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDocument(index)}
                      className="ml-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={uploadedDocuments.length === 0 || (loadFromBC && !selectedBCProject)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue to Review
          </button>
        </div>
      </div>
    </div>
  );
}
