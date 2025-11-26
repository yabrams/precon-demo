/**
 * ProjectCreationView Component
 * Embedded view for creating new projects - supports manual creation and platform imports
 * (BuildingConnected, PlanHub, ConstructConnect)
 */

'use client';

import { useState, useRef } from 'react';
import { X, Upload, ChevronDown, ChevronLeft } from 'lucide-react';

interface UploadedDocument {
  fileName: string;
  url: string;
  fileSize: number;
  fileType: string;
}

interface ExternalProject {
  id: string; // Generic ID field
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

type Platform = 'buildingconnected' | 'planhub' | 'constructconnect';

interface ProjectCreationViewProps {
  onBack: () => void;
  onContinue: (data: {
    mode: 'manual' | 'platform-import';
    platform?: Platform;
    uploadedDocuments: UploadedDocument[];
    selectedExternalProject?: ExternalProject;
    projectName?: string;
  }) => void;
}

export default function ProjectCreationView({
  onBack,
  onContinue
}: ProjectCreationViewProps) {
  const [loadFromPlatform, setLoadFromPlatform] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('buildingconnected');
  const [selectedExternalProject, setSelectedExternalProject] = useState<ExternalProject | null>(null);
  const [externalProjects, setExternalProjects] = useState<ExternalProject[]>([]);
  const [loadingExternalProjects, setLoadingExternalProjects] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [useMockData, setUseMockData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get API endpoint for selected platform
  const getPlatformEndpoint = (platform: Platform) => {
    switch (platform) {
      case 'buildingconnected':
        return '/api/buildingconnected/projects';
      case 'planhub':
        return '/api/planhub/projects';
      case 'constructconnect':
        return '/api/constructconnect/projects';
    }
  };

  // Get ID field name for selected platform
  const getProjectIdField = (platform: Platform) => {
    switch (platform) {
      case 'buildingconnected':
        return 'bcProjectId';
      case 'planhub':
        return 'phProjectId';
      case 'constructconnect':
        return 'ccProjectId';
    }
  };

  // Load projects from external platform
  const loadPlatformProjects = async (platform: Platform) => {
    setLoadingExternalProjects(true);
    setSelectedExternalProject(null);
    try {
      const endpoint = getPlatformEndpoint(platform);
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.success) {
        // Normalize the projects to use a generic 'id' field
        const idField = getProjectIdField(platform);
        const normalizedProjects = data.projects.map((proj: any) => ({
          ...proj,
          id: proj[idField]
        }));
        setExternalProjects(normalizedProjects);
      }
    } catch (error) {
      console.error(`Failed to load ${platform} projects:`, error);
    } finally {
      setLoadingExternalProjects(false);
    }
  };

  // Handle toggle for platform import
  const handleTogglePlatform = async (enabled: boolean) => {
    setLoadFromPlatform(enabled);
    if (enabled) {
      await loadPlatformProjects(selectedPlatform);
    } else {
      setExternalProjects([]);
      setSelectedExternalProject(null);
    }
  };

  // Handle platform selection change
  const handlePlatformChange = async (platform: Platform) => {
    setSelectedPlatform(platform);
    setSelectedExternalProject(null);
    if (loadFromPlatform) {
      await loadPlatformProjects(platform);
    }
  };

  // Handle file selection
  const handleFiles = async (files: FileList) => {
    setUploading(true);

    try {
      // Upload all files at once for better efficiency
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('file', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // Handle both single and multiple file responses
      let uploadedFiles: any[] = [];
      if (data.files) {
        // Multiple files response
        uploadedFiles = data.files.map((file: any) => ({
          fileName: file.fileName,
          url: file.url,
          fileSize: file.fileSize,
          fileType: file.fileType || 'application/octet-stream'
        }));
      } else {
        // Single file response
        uploadedFiles = [{
          fileName: data.fileName,
          url: data.url,
          fileSize: data.fileSize,
          fileType: data.fileType || 'application/octet-stream'
        }];
      }

      setUploadedDocuments(prev => [...prev, ...uploadedFiles]);
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

    onContinue({
      mode: 'manual',
      platform: undefined,
      uploadedDocuments,
      selectedExternalProject: undefined,
      projectName: projectName.trim() || undefined,
      useMockData
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="h-full bg-gray-50 overflow-auto flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Create New Project</h1>
            <p className="text-xs text-gray-600">Upload documents and configure project settings</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Project Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name or leave blank to extract from documents"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none text-zinc-900 placeholder:text-gray-400"
            />
          </div>

          {/* Upload Documents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Documents
            </label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 bg-white hover:bg-gray-50 cursor-pointer"
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
                    Drop documents here or click to browse
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
                            {doc.fileType ?
                              doc.fileType.split('/')[1]?.toUpperCase().slice(0, 3) || 'FILE' :
                              doc.fileName?.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'
                            }
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveDocument(index);
                      }}
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
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between">
          {/* Mock Data Toggle */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={useMockData}
              onChange={(e) => setUseMockData(e.target.checked)}
              className="w-4 h-4 text-zinc-900 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-zinc-900 transition-colors">
              Use Mock Data
            </span>
            {useMockData && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                Testing Mode
              </span>
            )}
          </label>

          <button
            onClick={handleContinue}
            disabled={uploadedDocuments.length === 0}
            className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {useMockData ? 'Generate Mock Data' : 'Process Documents'}
          </button>
        </div>
      </div>
    </div>
  );
}
