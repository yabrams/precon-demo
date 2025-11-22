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
    if (mode === 'manual') {
      extractProjectInfo();
    } else if (mode === 'platform-import' && selectedExternalProject && platform) {
      loadExternalProjectData();
    }
  }, []);

  const extractProjectInfo = async () => {
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
      if (data.success) {
        setProjectInfo(data.projectInfo);
        setBidPackages(data.bidPackages || []);
        setConfidence(data.confidence);
        setExtractionComplete(true);
      } else {
        alert('Failed to extract project information. Please fill in manually.');
        setExtractionComplete(true);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract project information. Please fill in manually.');
      setExtractionComplete(true);
    } finally {
      setExtracting(false);
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
            budgetAmount: pkg.budgetAmount || null
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
        setBidPackages(data.bidPackages);
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
    const projectData = {
      bcProjectId: mode === 'platform-import' && selectedExternalProject ? selectedExternalProject.id : `manual-proj-${Date.now()}`,
      ...projectInfo,
      status: mode === 'platform-import' ? selectedExternalProject?.status : 'bidding',
      uploadedDocuments,
      bidPackages: bidPackages.map(pkg => ({ ...pkg, status: 'draft', progress: 0 })),
      platform: mode === 'platform-import' ? platform : undefined
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
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-4">
          <button onClick={onCancel} className="text-gray-600 hover:text-zinc-900 transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900">Review Project Information</h1>
            <p className="text-gray-600 text-sm mt-1">
              {mode === 'platform-import'
                ? `${platform === 'buildingconnected' ? 'BuildingConnected' : platform === 'planhub' ? 'PlanHub' : 'ConstructConnect'} Import`
                : 'Manual Creation'} • {uploadedDocuments.length} document(s)
            </p>
          </div>
        </div>
      </div>

      {extracting && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-blue-700 text-sm">
            {mode === 'manual'
              ? 'Extracting project information from documents...'
              : `Loading ${platform === 'buildingconnected' ? 'BuildingConnected' : platform === 'planhub' ? 'PlanHub' : 'ConstructConnect'} project data...`}
          </p>
        </div>
      )}

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
          <div className="p-6 max-w-4xl">
            <form className="space-y-8">
              {/* Content continues but hitting char limit - see next message */}
            </form>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
        <button onClick={onCancel} className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">Cancel</button>
        <button onClick={handleApprove} disabled={!projectInfo.name} className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed">Approve & Create Project</button>
      </div>
    </div>
  );
}
