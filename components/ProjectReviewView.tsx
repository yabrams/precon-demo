/**
 * ProjectReviewView Component
 * Review and edit project information before final creation
 * Supports manual creation and platform imports (BuildingConnected, PlanHub, ConstructConnect)
 */

'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import CSIInlineSearch from './CSIInlineSearch';

// Dynamically import PDFViewer to avoid SSR issues with pdf.js
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
    </div>
  ),
});

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
  csiCode: string | null;
  csiTitle: string | null;
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
  initialProjectName?: string;
  useMockData?: boolean;
  onApprove: (projectData: any) => void;
  onCancel: () => void;
}

export default function ProjectReviewView({
  mode,
  platform,
  uploadedDocuments,
  selectedExternalProject,
  initialProjectName,
  useMockData = false,
  onApprove,
  onCancel
}: ProjectReviewViewProps) {
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);
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
  const [editingCSIIndex, setEditingCSIIndex] = useState<number | null>(null);

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
      // Extract bid packages and line items from documents
      // This now also extracts project name and description
      await extractBidPackagesFromDocuments();
      setExtractionComplete(true);
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
      let extractedProjectName: string | null = null;
      let extractedProjectDescription: string | null = null;

      // Extract from each document
      for (const doc of uploadedDocuments) {
        try {
          const extractResponse = await fetch('/api/extract-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: doc.url,
              useMockData,
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

            // Extract project name and description from the first document that has them
            if (!extractedProjectName && extractData.project_name) {
              extractedProjectName = extractData.project_name;
            }
            if (!extractedProjectDescription && extractData.project_description) {
              extractedProjectDescription = extractData.project_description;
            }
          }
        } catch (error) {
          console.error('Failed to extract from document:', doc.fileName, error);
        }
      }

      // Store the extraction results to use when project is approved
      setExtractedBidPackagesData(extractionResults);

      // Set project name and description from extracted data
      // If initialProjectName was provided by user, use it instead of extracted name
      if (extractedProjectName || extractedProjectDescription || initialProjectName) {
        setProjectInfo(prev => ({
          ...prev,
          name: initialProjectName || extractedProjectName || prev.name || 'New Project ' + new Date().toISOString().split('T')[0],
          description: extractedProjectDescription || prev.description
        }));
      }

      // Extract bid package summaries from extractedBidPackagesData for display
      const allBidPackages: BidPackageInfo[] = [];
      extractionResults.forEach((result: any) => {
        if (result.extractionData?.bid_packages) {
          result.extractionData.bid_packages.forEach((pkg: any) => {
            if (pkg.line_items && pkg.line_items.length > 0) {
              allBidPackages.push({
                name: pkg.name,
                csiCode: null,
                csiTitle: null,
                captainId: null
              });
            }
          });
        }
      });
      setBidPackages(allBidPackages);

      setIsBidPackageExtractionComplete(true);
      console.log('Pre-extraction complete. Data ready for project creation.');
      console.log('Extracted project name:', extractedProjectName);
      console.log('Extracted project description:', extractedProjectDescription);
      console.log('Extracted bid packages count:', allBidPackages.length);
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
            csiCode: pkg.csiCode || null,
            csiTitle: pkg.csiTitle || null,
            captainId: pkg.captainId || null
          })));
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
      name: projectInfo.name,
      description: projectInfo.description,
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
      <div className="flex-1 flex overflow-hidden">
        <div className="w-3/5 border-r border-gray-200 flex flex-col bg-white">
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            {currentDoc.fileType === 'application/pdf' || currentDoc.fileName.toLowerCase().endsWith('.pdf') ? (
              <PDFViewer
                documents={{
                  url: currentDoc.url,
                  fileName: currentDoc.fileName
                }}
                className="h-full w-full"
              />
            ) : currentDoc.fileType.startsWith('image/') ? (
              <div className="p-6">
                <img src={currentDoc.url} alt={currentDoc.fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-gray-200" />
              </div>
            ) : (
              <div className="text-center p-6">
                <div className="w-24 h-24 bg-zinc-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-zinc-600 font-bold text-2xl">FILE</span>
                </div>
                <p className="text-gray-900 font-medium">{currentDoc.fileName}</p>
                <a href={currentDoc.url} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-800 text-sm mt-2 inline-block underline">Open in new tab</a>
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

        <div className="w-2/5 overflow-y-auto bg-gray-50">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={projectInfo.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400"
                      placeholder="Enter project name"
                    />
                  </div>
                </div>

                {/* Bid Packages */}
                {bidPackages.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-900 border-b pb-2">Bid Packages</h2>
                    <div className="space-y-3">
                      {bidPackages.map((pkg, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Package Name</label>
                              <input
                                type="text"
                                value={pkg.name}
                                onChange={(e) => {
                                  const updated = [...bidPackages];
                                  updated[index].name = e.target.value;
                                  setBidPackages(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 text-sm"
                                placeholder="Package name"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">CSI Division</label>
                              {editingCSIIndex === index ? (
                                <CSIInlineSearch
                                  initialValue={pkg.csiCode || pkg.csiTitle || ''}
                                  onSelect={(code, title) => {
                                    const updated = [...bidPackages];
                                    updated[index].csiCode = code;
                                    updated[index].csiTitle = title;
                                    setBidPackages(updated);
                                    setEditingCSIIndex(null);
                                  }}
                                  onBlur={() => setEditingCSIIndex(null)}
                                  placeholder="Search CSI division..."
                                  levelFilter={[1]}
                                  showAllOnFocus={true}
                                />
                              ) : (
                                <div
                                  onClick={() => setEditingCSIIndex(index)}
                                  className="w-full px-3 py-2 text-sm rounded-lg min-h-[2.5rem] flex items-center cursor-pointer hover:bg-gray-50 border border-gray-300"
                                >
                                  {pkg.csiCode ? (
                                    <span className="text-zinc-900">
                                      <span className="font-mono font-semibold">{pkg.csiCode}</span>
                                      {pkg.csiTitle && <span className="text-zinc-600 ml-2">{pkg.csiTitle}</span>}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Click to add CSI code...</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="col-span-2">
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 text-sm"
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
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBidPackages([...bidPackages, { name: '', csiCode: null, csiTitle: null, captainId: null }])}
                      className="text-sm text-zinc-600 hover:text-zinc-800 font-medium"
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
