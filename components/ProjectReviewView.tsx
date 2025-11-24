/**
 * ProjectReviewView Component
 * Review and edit project information before final creation
 * Supports manual creation and platform imports (BuildingConnected, PlanHub, ConstructConnect)
 */

'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

type Platform = 'buildingconnected' | 'planhub' | 'constructconnect';

interface UploadedDocument {
  fileName: string;
  url: string;
  fileSize: number;
  fileType: string;
}

interface ExtractedProjectInfo {
  name: string | null;
  projectNumber: string | null;
  description: string | null;
  location: {
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string;
  };
  bidDueDate: string | null;
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectValue: number | null;
  marketSector: string | null;
  projectType: string | null;
  buildingType: string | null;
  ownerName: string | null;
  architectName: string | null;
  engineerName: string | null;
  generalContractorName: string | null;
  estimatedSquareFootage: number | null;
  numberOfFloors: number | null;
  projectPhase: string | null;
  fundingType: string | null;
  deliveryMethod: string | null;
  contractType: string | null;
  bondingRequired: boolean | null;
  prevailingWageRequired: boolean | null;
  minorityBusinessGoal: number | null;
  womenBusinessGoal: number | null;
}

interface BidPackageInfo {
  name: string;
  description: string;
  budgetAmount: number | null;
  captainId: string | null;
}

interface ExternalProject {
  id: string; // Generic ID - will be bcProjectId, phProjectId, or ccProjectId
  name: string;
  projectNumber?: string;
  description?: string;
  status: string;
  location?: any;
  projectValue?: number;
  marketSector?: string;
  bidPackages?: any[];
}

interface ProjectReviewViewProps {
  mode: 'manual' | 'platform-import';
  platform?: Platform;
  uploadedDocuments: UploadedDocument[];
  selectedExternalProject?: ExternalProject;
  onApprove: (projectData: any) => void;
  onCancel: () => void;
}

export default function ProjectReviewView({
  mode,
  platform,
  uploadedDocuments,
  selectedExternalProject,
  onApprove,
  onCancel
}: ProjectReviewViewProps) {
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);
  const [showMissingPackagesPrompt, setShowMissingPackagesPrompt] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ExtractedProjectInfo>({
    name: null,
    projectNumber: null,
    description: null,
    location: { address: null, city: null, state: null, zipCode: null, country: 'USA' },
    bidDueDate: null,
    projectStartDate: null,
    projectEndDate: null,
    projectValue: null,
    marketSector: null,
    projectType: null,
    buildingType: null,
    ownerName: null,
    architectName: null,
    engineerName: null,
    generalContractorName: null,
    estimatedSquareFootage: null,
    numberOfFloors: null,
    projectPhase: null,
    fundingType: null,
    deliveryMethod: null,
    contractType: null,
    bondingRequired: null,
    prevailingWageRequired: null,
    minorityBusinessGoal: null,
    womenBusinessGoal: null
  });
  const [bidPackages, setBidPackages] = useState<BidPackageInfo[]>([]);
  const [confidence, setConfidence] = useState<any>(null);
  const [users, setUsers] = useState<Array<{ id: string; firstName?: string; lastName?: string; userName: string }>>([]);
  const [extractedBidPackagesData, setExtractedBidPackagesData] = useState<any>(null);
  const [isBidPackageExtractionComplete, setIsBidPackageExtractionComplete] = useState(false);

  // Get API endpoint for the platform
  const getPlatformEndpoint = (plat: Platform) => {
    switch (plat) {
      case 'buildingconnected':
        return '/api/buildingconnected/projects';
      case 'planhub':
        return '/api/planhub/projects';
      case 'constructconnect':
        return '/api/constructconnect/projects';
    }
  };

  // Get ID field name for the platform
  const getProjectIdField = (plat: Platform) => {
    switch (plat) {
      case 'buildingconnected':
        return 'bcProjectId';
      case 'planhub':
        return 'phProjectId';
      case 'constructconnect':
        return 'ccProjectId';
    }
  };

  useEffect(() => {
    loadUsers();
    if (mode === 'manual') {
      extractProjectInfo();
    } else if (mode === 'platform-import' && selectedExternalProject && platform) {
      loadExternalProjectData();
    }
  }, []);

  const loadUsers = async () => {
    try {
      console.log('Loading users...');
      const response = await fetch('/api/users');
      console.log('Users response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Users data:', data);
        setUsers(data.users || []);
      } else {
        console.error('Failed to load users, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const extractProjectInfo = async () => {
    setExtracting(true);
    try {
      // Extract project info
      const response = await fetch('/api/ai/extract-project-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrls: uploadedDocuments.map(d => d.url),
          documentNames: uploadedDocuments.map(d => d.fileName)
        })
      });
      const data = await response.json();
      if (data.success) {
        setProjectInfo(data.projectInfo);
        setBidPackages(data.bidPackages || []);
        setConfidence(data.confidence);

        // Also extract bid packages and line items from documents
        // This happens in parallel so everything is ready when user approves
        await extractBidPackagesFromDocuments();

        setExtractionComplete(true);
      } else {
        // Check if it's a PDF-specific error
        if (data.message && data.message.includes('PDF files are not currently supported')) {
          alert(data.message + '\n\nNote: For PDF extraction, please use the regular extraction workflow which supports PDF processing.');
        } else {
          alert(data.error || 'Failed to extract project information. Please fill in manually.');
          // Set a default project name so the user can proceed
          setProjectInfo(prev => ({
            ...prev,
            name: prev.name || 'New Project ' + new Date().toISOString().split('T')[0]
          }));
        }
        setExtractionComplete(true);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract project information. Please fill in manually.');
      // Set a default project name so the user can proceed
      setProjectInfo(prev => ({
        ...prev,
        name: prev.name || 'New Project ' + new Date().toISOString().split('T')[0]
      }));
      setExtractionComplete(true);
    } finally {
      setExtracting(false);
    }
  };

  const extractBidPackagesFromDocuments = async () => {
    try {
      setIsBidPackageExtractionComplete(false);
      console.log('Pre-extracting bid packages and line items from documents...');
      const extractionResults = [];

      // Extract from each document
      for (const doc of uploadedDocuments) {
        try {
          const extractResponse = await fetch('/api/extract-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: doc.url,
              // Don't pass projectId - we just want the extraction data, not to save to DB yet
            })
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            extractionResults.push({
              documentUrl: doc.url,
              diagramId: doc.diagramId,
              extractionData: extractData
            });
          }
        } catch (error) {
          console.error('Failed to extract from document:', doc.fileName, error);
        }
      }

      // Store the extraction results to use when project is approved
      setExtractedBidPackagesData(extractionResults);
      setIsBidPackageExtractionComplete(true);
      console.log('Pre-extraction complete. Data ready for project creation.');
    } catch (error) {
      console.error('Error during pre-extraction:', error);
      setIsBidPackageExtractionComplete(true); // Allow user to proceed even if extraction fails
    }
  };

  const loadExternalProjectData = async () => {
    if (!selectedExternalProject || !platform) return;
    setExtracting(true);
    try {
      const endpoint = getPlatformEndpoint(platform);
      const idField = getProjectIdField(platform);
      const response = await fetch(`${endpoint}?${idField}=${selectedExternalProject.id}`);
      const data = await response.json();
      if (data.success && data.project) {
        const proj = data.project;
        setProjectInfo({
          name: proj.name,
          projectNumber: proj.projectNumber || null,
          description: proj.description || null,
          location: {
            address: proj.location?.address || null,
            city: proj.location?.city || null,
            state: proj.location?.state || null,
            zipCode: proj.location?.zipCode || null,
            country: proj.location?.country || 'USA'
          },
          bidDueDate: proj.bidDueDate || null,
          projectStartDate: proj.projectStartDate || null,
          projectEndDate: proj.projectEndDate || null,
          projectValue: proj.projectValue || null,
          marketSector: proj.marketSector || null,
          projectType: proj.projectType || null,
          buildingType: proj.buildingType || null,
          ownerName: proj.ownerName || null,
          architectName: proj.architectName || null,
          engineerName: proj.engineerName || null,
          generalContractorName: proj.generalContractorName || null,
          estimatedSquareFootage: proj.estimatedSquareFootage || null,
          numberOfFloors: proj.numberOfFloors || null,
          projectPhase: proj.projectPhase || null,
          fundingType: proj.fundingType || null,
          deliveryMethod: proj.deliveryMethod || null,
          contractType: proj.contractType || null,
          bondingRequired: proj.bondingRequired || null,
          prevailingWageRequired: proj.prevailingWageRequired || null,
          minorityBusinessGoal: proj.minorityBusinessGoal || null,
          womenBusinessGoal: proj.womenBusinessGoal || null
        });
        if (proj.bidPackages && proj.bidPackages.length > 0) {
          setBidPackages(proj.bidPackages.map((pkg: any) => ({
            name: pkg.name,
            description: pkg.description || '',
            budgetAmount: pkg.budgetAmount || null,
            captainId: pkg.captainId || null
          })));
        } else {
          setShowMissingPackagesPrompt(true);
        }
        setExtractionComplete(true);
      }
    } catch (error) {
      console.error(`Failed to load ${platform} project:`, error);
      alert(`Failed to load ${platform} project data.`);
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractBidPackages = async () => {
    setShowMissingPackagesPrompt(false);
    setExtracting(true);
    try {
      const response = await fetch('/api/ai/extract-project-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrls: uploadedDocuments.map(d => d.url),
          documentNames: uploadedDocuments.map(d => d.fileName)
        })
      });
      const data = await response.json();
      if (data.success && data.bidPackages) {
        setBidPackages(data.bidPackages.map((pkg: any) => ({
          name: pkg.name,
          description: pkg.description || '',
          budgetAmount: pkg.budgetAmount || null,
          captainId: pkg.captainId || null
        })));
      }
    } catch (error) {
      console.error('Bid package extraction error:', error);
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = () => {
    if (!projectInfo.name) {
      alert('Project name is required');
      return;
    }

    // Determine the correct ID field based on platform
    const externalId = mode === 'platform-import' && selectedExternalProject
      ? selectedExternalProject.id
      : `manual-proj-${Date.now()}`;

    const idField = mode === 'platform-import' && platform
      ? getProjectIdField(platform)
      : 'bcProjectId';

    const projectData = {
      [idField]: externalId,
      ...projectInfo,
      status: mode === 'platform-import' ? selectedExternalProject?.status : 'bidding',
      uploadedDocuments,
      bidPackages: bidPackages.map(pkg => ({ ...pkg, status: 'draft', progress: 0 })),
      platform: mode === 'platform-import' ? platform : undefined,
      extractedBidPackagesData // Pass the pre-extracted bid packages data
    };
    onApprove(projectData);
  };

  const updateField = (field: string, value: any) => {
    if (field.startsWith('location.')) {
      const locationField = field.split('.')[1];
      setProjectInfo(prev => ({ ...prev, location: { ...prev.location, [locationField]: value } }));
    } else {
      setProjectInfo(prev => ({ ...prev, [field]: value }));
    }
  };

  const currentDoc = uploadedDocuments[currentDocIndex];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-6 h-[68px] border-b border-gray-200 bg-white flex items-center">
        <div className="flex items-center space-x-4 w-full">
          <button onClick={onCancel} className="text-gray-600 hover:text-zinc-900 transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900">Review Project Information</h1>
          </div>
        </div>
      </div>

      {showMissingPackagesPrompt && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-amber-900 font-medium">
                No bid packages found in {platform === 'buildingconnected' ? 'BuildingConnected' : platform === 'planhub' ? 'PlanHub' : 'ConstructConnect'}
              </p>
              <p className="text-amber-700 text-sm mt-1">Would you like to extract bid packages from the uploaded documents?</p>
              <div className="mt-3 flex space-x-3">
                <button onClick={handleExtractBidPackages} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium">Extract from Documents</button>
                <button onClick={() => setShowMissingPackagesPrompt(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-zinc-900">Documents</h3>
            <p className="text-sm text-gray-600 mt-1">{currentDocIndex + 1} of {uploadedDocuments.length}</p>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
            {currentDoc.fileType.startsWith('image/') ? (
              <img src={currentDoc.url} alt={currentDoc.fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-gray-200" />
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold text-2xl">PDF</span>
                </div>
                <p className="text-gray-900 font-medium">{currentDoc.fileName}</p>
                <a href={currentDoc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">Open in new tab</a>
              </div>
            )}
          </div>
          {uploadedDocuments.length > 1 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white">
              <button onClick={() => setCurrentDocIndex(prev => Math.max(0, prev - 1))} disabled={currentDocIndex === 0} className="p-2 text-gray-600 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-gray-600 text-sm truncate max-w-xs">{currentDoc.fileName}</span>
              <button onClick={() => setCurrentDocIndex(prev => Math.min(uploadedDocuments.length - 1, prev + 1))} disabled={currentDocIndex === uploadedDocuments.length - 1} className="p-2 text-gray-600 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {extracting ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
                <p className="text-zinc-900 text-base font-medium">
                  {mode === 'manual'
                    ? 'Extracting project information and bidding packages...'
                    : `Loading ${platform === 'buildingconnected' ? 'BuildingConnected' : platform === 'planhub' ? 'PlanHub' : 'ConstructConnect'} project data...`}
                </p>
                <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
              </div>
            </div>
          ) : (
            <div className="p-5 max-w-4xl">
              <form className="space-y-6">
                {/* Project Basic Information */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Project Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={projectInfo.name || ''}
                        onChange={(e) => updateField('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter project name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Number</label>
                      <input
                        type="text"
                        value={projectInfo.projectNumber || ''}
                        onChange={(e) => updateField('projectNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter project number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={projectInfo.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project description"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Location</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={projectInfo.location.address || ''}
                      onChange={(e) => updateField('location.address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={projectInfo.location.city || ''}
                        onChange={(e) => updateField('location.city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={projectInfo.location.state || ''}
                        onChange={(e) => updateField('location.state', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="State"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                      <input
                        type="text"
                        value={projectInfo.location.zipCode || ''}
                        onChange={(e) => updateField('location.zipCode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ZIP"
                      />
                    </div>
                  </div>
                </div>

                {/* Dates & Financial */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Schedule & Budget</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bid Due Date</label>
                      <input
                        type="date"
                        value={projectInfo.bidDueDate || ''}
                        onChange={(e) => updateField('bidDueDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Value</label>
                      <input
                        type="number"
                        value={projectInfo.projectValue || ''}
                        onChange={(e) => updateField('projectValue', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter project value"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Start Date</label>
                      <input
                        type="date"
                        value={projectInfo.projectStartDate || ''}
                        onChange={(e) => updateField('projectStartDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project End Date</label>
                      <input
                        type="date"
                        value={projectInfo.projectEndDate || ''}
                        onChange={(e) => updateField('projectEndDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Project Details</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Market Sector</label>
                      <input
                        type="text"
                        value={projectInfo.marketSector || ''}
                        onChange={(e) => updateField('marketSector', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Commercial, Healthcare"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                      <input
                        type="text"
                        value={projectInfo.projectType || ''}
                        onChange={(e) => updateField('projectType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., New Construction, Renovation"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Building Type</label>
                      <input
                        type="text"
                        value={projectInfo.buildingType || ''}
                        onChange={(e) => updateField('buildingType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Office, Hospital"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Project Phase</label>
                      <input
                        type="text"
                        value={projectInfo.projectPhase || ''}
                        onChange={(e) => updateField('projectPhase', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Design, Bidding"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Square Footage</label>
                      <input
                        type="number"
                        value={projectInfo.estimatedSquareFootage || ''}
                        onChange={(e) => updateField('estimatedSquareFootage', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Square feet"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Floors</label>
                      <input
                        type="number"
                        value={projectInfo.numberOfFloors || ''}
                        onChange={(e) => updateField('numberOfFloors', parseInt(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Number of floors"
                      />
                    </div>
                  </div>
                </div>

                {/* Stakeholders */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Project Team</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                      <input
                        type="text"
                        value={projectInfo.ownerName || ''}
                        onChange={(e) => updateField('ownerName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Owner name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Architect</label>
                      <input
                        type="text"
                        value={projectInfo.architectName || ''}
                        onChange={(e) => updateField('architectName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Architect name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Engineer</label>
                      <input
                        type="text"
                        value={projectInfo.engineerName || ''}
                        onChange={(e) => updateField('engineerName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Engineer name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">General Contractor</label>
                      <input
                        type="text"
                        value={projectInfo.generalContractorName || ''}
                        onChange={(e) => updateField('generalContractorName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="GC name"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Details */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Contract Details</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Funding Type</label>
                      <input
                        type="text"
                        value={projectInfo.fundingType || ''}
                        onChange={(e) => updateField('fundingType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Public, Private"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Method</label>
                      <input
                        type="text"
                        value={projectInfo.deliveryMethod || ''}
                        onChange={(e) => updateField('deliveryMethod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Design-Bid-Build"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                      <input
                        type="text"
                        value={projectInfo.contractType || ''}
                        onChange={(e) => updateField('contractType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Lump Sum, Unit Price"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="bondingRequired"
                        checked={projectInfo.bondingRequired || false}
                        onChange={(e) => updateField('bondingRequired', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="bondingRequired" className="text-sm font-medium text-gray-700">
                        Bonding Required
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="prevailingWage"
                        checked={projectInfo.prevailingWageRequired || false}
                        onChange={(e) => updateField('prevailingWageRequired', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="prevailingWage" className="text-sm font-medium text-gray-700">
                        Prevailing Wage Required
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">MBE Goal (%)</label>
                      <input
                        type="number"
                        value={projectInfo.minorityBusinessGoal || ''}
                        onChange={(e) => updateField('minorityBusinessGoal', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Percentage"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WBE Goal (%)</label>
                      <input
                        type="number"
                        value={projectInfo.womenBusinessGoal || ''}
                        onChange={(e) => updateField('womenBusinessGoal', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Percentage"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                </div>

                {/* Bid Packages */}
                {bidPackages.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Bid Packages</h2>
                    <div className="space-y-3">
                      {bidPackages.map((pkg, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Package Name</label>
                              <input
                                type="text"
                                value={pkg.name}
                                onChange={(e) => {
                                  const updated = [...bidPackages];
                                  updated[index].name = e.target.value;
                                  setBidPackages(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Package name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Budget Amount</label>
                              <input
                                type="number"
                                value={pkg.budgetAmount || ''}
                                onChange={(e) => {
                                  const updated = [...bidPackages];
                                  updated[index].budgetAmount = parseFloat(e.target.value) || null;
                                  setBidPackages(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Budget"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Captain {users.length > 0 && `(${users.length} available)`}
                              </label>
                              <select
                                value={pkg.captainId || ''}
                                onChange={(e) => {
                                  const updated = [...bidPackages];
                                  updated[index].captainId = e.target.value || null;
                                  setBidPackages(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              >
                                <option value="">Select a captain...</option>
                                {users.map((user) => {
                                  console.log('Rendering user option:', user);
                                  return (
                                    <option key={user.id} value={user.id}>
                                      {user.firstName && user.lastName
                                        ? `${user.firstName} ${user.lastName} (${user.userName})`
                                        : user.userName}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                              <textarea
                                value={pkg.description}
                                onChange={(e) => {
                                  const updated = [...bidPackages];
                                  updated[index].description = e.target.value;
                                  setBidPackages(updated);
                                }}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Package description"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBidPackages([...bidPackages, { name: '', description: '', budgetAmount: null, captainId: null }])}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Bid Package
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
        <button onClick={onCancel} className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">Cancel</button>
        <div className="flex items-center space-x-4">
          {!isBidPackageExtractionComplete && extractionComplete && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              <span>Extracting bid packages...</span>
            </div>
          )}
          <button
            onClick={handleApprove}
            disabled={!projectInfo.name || !isBidPackageExtractionComplete}
            className="px-8 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Approve & Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
