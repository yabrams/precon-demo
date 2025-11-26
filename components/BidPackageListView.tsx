'use client';

/**
 * Bid Package List View Component
 * Displays bid packages for a selected BuildingConnected project
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronDown, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { BidPackage } from '@/types/bidPackage';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { useEditMode } from '@/contexts/EditModeContext';

// Dynamically import PDFViewer to avoid SSR issues with pdf.js
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
    </div>
  ),
});

interface User {
  id: string;
  email: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

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
  onProjectUpdate?: (updatedProject: BuildingConnectedProject, updatedBidPackages: BidPackage[]) => void;
  onSaveComplete?: () => Promise<void>;
}

export default function BidPackageListView({
  project,
  bidPackages,
  onBidPackageSelect,
  onBack,
  onUploadDiagrams,
  onUploadSuccess,
  onProjectUpdate,
  onSaveComplete,
}: BidPackageListViewProps) {
  const { isEditMode, registerCallbacks, unregisterCallbacks } = useEditMode();
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    project.diagrams?.[0]?.id || null
  );
  const imageRef = useRef<HTMLImageElement>(null);

  // State for tracking edits
  const [editedBidPackages, setEditedBidPackages] = useState<BidPackage[]>([]);
  const [editedProject, setEditedProject] = useState<BuildingConnectedProject>(project);

  // State for users list
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // State for captain selector dropdown
  const [captainSelectorOpen, setCaptainSelectorOpen] = useState<string | null>(null);

  // Fetch users when component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched users:', data);
          setUsers(data.users || []);
        } else {
          console.error('Failed to fetch users, status:', response.status);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Save handler for edit mode
  const handleSave = useCallback(async () => {
    console.log('Saving changes...', { editedProject, editedBidPackages });

    // Update parent component's state immediately
    if (onProjectUpdate) {
      onProjectUpdate(editedProject, editedBidPackages);
    }

    // Persist to database
    try {
      let allSuccess = true;

      // Update each bid package that was modified
      for (const bidPackage of editedBidPackages) {
        console.log('Updating bid package:', bidPackage.id, bidPackage);
        const response = await fetch(`/api/bid-packages/${bidPackage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bidPackage),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to update bid package:', bidPackage.id, errorData);
          allSuccess = false;
        } else {
          const data = await response.json();
          console.log('Bid package updated successfully:', data);
        }
      }

      // Update project information
      console.log('Updating project:', editedProject.id);
      const projectResponse = await fetch(`/api/projects/${editedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedProject),
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json();
        console.error('Failed to update project:', errorData);
        allSuccess = false;
      } else {
        const data = await projectResponse.json();
        console.log('Project updated successfully:', data);
      }

      if (allSuccess) {
        console.log('All changes saved successfully');
        // Reload projects from database
        if (onSaveComplete) {
          await onSaveComplete();
        }
      } else {
        alert('Some changes failed to save. Please check the console and try again.');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    }
  }, [editedProject, editedBidPackages, onProjectUpdate, onSaveComplete]);

  // Delete handler for edit mode
  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Reload projects to update the list
      if (onSaveComplete) {
        await onSaveComplete();
      }

      // Navigate back to projects list
      onBack();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  }, [project.id, onSaveComplete, onBack]);

  // Register callbacks with the EditModeContext on mount, unregister on unmount
  useEffect(() => {
    registerCallbacks({
      onSave: handleSave,
      onDelete: handleDelete,
    });
    // Only unregister on unmount
    return () => {
      unregisterCallbacks();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - register once on mount

  // Update callbacks when they change (refs in context will be updated)
  useEffect(() => {
    registerCallbacks({
      onSave: handleSave,
      onDelete: handleDelete,
    });
  }, [handleSave, handleDelete, registerCallbacks]);

  // Initialize edit state when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setEditedBidPackages(JSON.parse(JSON.stringify(bidPackages)));
      setEditedProject(JSON.parse(JSON.stringify(project)));
    }
  }, [isEditMode, bidPackages, project]);

  // Update bid package field
  const updateBidPackage = (index: number, field: string, value: any) => {
    setEditedBidPackages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Update project field
  const updateProjectField = (field: string, value: any) => {
    setEditedProject(prev => ({ ...prev, [field]: value }));
  };

  // Update nested project location field
  const updateProjectLocation = (field: string, value: any) => {
    setEditedProject(prev => ({
      ...prev,
      location: { ...prev.location, [field]: value }
    }));
  };

  const currentDiagram = selectedDiagramId
    ? project.diagrams?.find(d => d.id === selectedDiagramId)
    : project.diagrams?.[0];

  // Check if current diagram is a PDF
  const isPDF = currentDiagram ?
    (currentDiagram.fileType === 'application/pdf' || currentDiagram.fileName.toLowerCase().endsWith('.pdf'))
    : false;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to do':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'assigned':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'in progress':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'in review':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'bidding':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'bidding leveling':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
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

  const getCaptainInitials = (bidPackage?: any) => {
    // Try to get name from captain object first, then fall back to captainName
    let captainName = '';
    if (bidPackage?.captain) {
      const captain = bidPackage.captain;
      captainName = captain.firstName && captain.lastName
        ? `${captain.firstName} ${captain.lastName}`
        : captain.userName || '';
    } else if (bidPackage?.captainName) {
      captainName = bidPackage.captainName;
    }

    if (!captainName) return '?';
    const parts = captainName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
      const name = parts[0];
      return name.length >= 2 ? `${name[0]}${name[name.length - 1]}`.toUpperCase() : name[0].toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const getCaptainName = (bidPackage?: any) => {
    // Helper to get captain display name
    if (bidPackage?.captain) {
      const captain = bidPackage.captain;
      return captain.firstName && captain.lastName
        ? `${captain.firstName} ${captain.lastName}`
        : captain.userName || '';
    }
    return bidPackage?.captainName || '';
  };

  // Helper to format user display name
  const formatUserName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.userName;
  };

  // Calculate approval percentage from bid package
  const getApprovalPercentage = (bidPackage: BidPackage): number => {
    // If progress field exists and is set, use it
    if (bidPackage.progress !== undefined && bidPackage.progress !== null) {
      return Math.max(0, Math.min(100, bidPackage.progress));
    }

    // Calculate from counts
    const counts = getApprovalCounts(bidPackage);
    if (counts.total === 0) return 0;

    return Math.round((counts.approved / counts.total) * 100);
  };

  // Get approval counts for display
  const getApprovalCounts = (bidPackage: BidPackage): { approved: number; total: number } => {
    try {
      // First, try to get counts from workspaceData (for packages that have been worked on)
      if (bidPackage.workspaceData && bidPackage.workspaceData.trim() !== '') {
        const workspaceData = JSON.parse(bidPackage.workspaceData);

        // Check if workspaceData has lineItems array
        if (workspaceData?.lineItems && Array.isArray(workspaceData.lineItems)) {
          const totalItems = workspaceData.lineItems.length;
          const approvedItems = workspaceData.lineItems.filter((item: any) => item.approved === true).length;
          return { approved: approvedItems, total: totalItems };
        }
      }

      // Fall back to bidForms lineItems (for packages not yet opened/edited)
      if (bidPackage.bidForms && Array.isArray(bidPackage.bidForms)) {
        let totalItems = 0;
        let approvedItems = 0;

        bidPackage.bidForms.forEach((form: any) => {
          if (form.lineItems && Array.isArray(form.lineItems)) {
            totalItems += form.lineItems.length;
            approvedItems += form.lineItems.filter((item: any) => item.approved === true).length;
          }
        });

        return { approved: approvedItems, total: totalItems };
      }

      // No line items found
      return { approved: 0, total: 0 };
    } catch (error) {
      console.error('Error getting approval counts for bid package:', bidPackage.id, error);
      console.error('workspaceData:', bidPackage.workspaceData);
      return { approved: 0, total: 0 };
    }
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

  // Handle captain assignment in non-edit mode
  const handleCaptainAssignment = async (bidPackageId: string, userId: string) => {
    try {
      console.log('Assigning captain:', { bidPackageId, userId, availableUsers: users });

      const selectedUser = users.find(u => u.id === userId);
      if (!selectedUser) {
        console.error('User not found:', userId);
        alert('Selected user not found');
        return;
      }

      // Find the current bid package to get all its data
      const currentBidPackage = bidPackages.find(bp => bp.id === bidPackageId);
      if (!currentBidPackage) {
        console.error('Bid package not found:', bidPackageId);
        alert('Bid package not found');
        return;
      }

      // Merge captain data with existing bid package data
      const updatedBidPackage = {
        ...currentBidPackage,
        captainId: userId,
        captainName: formatUserName(selectedUser),
        captain: {
          id: selectedUser.id,
          userName: selectedUser.userName,
          firstName: selectedUser.firstName,
          lastName: selectedUser.lastName,
          email: selectedUser.email,
          role: selectedUser.role
        }
      };

      console.log('Updating bid package with captain:', updatedBidPackage);

      const response = await fetch(`/api/bid-packages/${bidPackageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBidPackage),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to update captain:', errorData);
        throw new Error('Failed to update captain');
      }

      console.log('Captain assigned successfully');

      // Update local state without full page reload
      if (onProjectUpdate) {
        const updatedBidPackages = bidPackages.map(bp =>
          bp.id === bidPackageId ? updatedBidPackage : bp
        );
        onProjectUpdate(project, updatedBidPackages);
      }

      setCaptainSelectorOpen(null);
    } catch (error) {
      console.error('Error updating captain:', error);
      alert('Failed to assign captain. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Main Content with Panels */}
      <div className="flex-1 min-h-0">
        {project.diagrams && project.diagrams.length > 0 ? (
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Documents */}
            <Panel defaultSize={50} minSize={20} className="bg-white border-r border-gray-200">
              <div className="h-full flex flex-col">
                {/* Diagram Selector - only show if multiple diagrams */}
                {project.diagrams.length > 1 && (
                  <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
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
                  </div>
                )}

                {/* Diagram Viewer */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                  {currentDiagram ? (
                    isPDF ? (
                      // PDF Viewer
                      <div className="h-full">
                        <PDFViewer
                          documents={{
                            url: currentDiagram.fileUrl,
                            fileName: currentDiagram.fileName
                          }}
                          className="h-full"
                        />
                      </div>
                    ) : (
                      // Image Viewer
                      <img
                        ref={imageRef}
                        src={currentDiagram.fileUrl}
                        alt={currentDiagram.fileName}
                        className="max-w-full h-auto mx-auto object-contain"
                      />
                    )
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

            {/* Right Panel: Bid Packages */}
            <Panel defaultSize={50} minSize={30} className="bg-gray-50">
              <div className="h-full overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-4">
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
                            {editedBidPackages.map((bidPackage, index) => (
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
                                    value={bidPackage.name}
                                    onChange={(e) => updateBidPackage(index, 'name', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                  <textarea
                                    value={bidPackage.description || ''}
                                    onChange={(e) => updateBidPackage(index, 'description', e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Budget Amount</label>
                                    <input
                                      type="number"
                                      value={bidPackage.budgetAmount || ''}
                                      onChange={(e) => updateBidPackage(index, 'budgetAmount', parseFloat(e.target.value) || null)}
                                      placeholder="0.00"
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                      value={bidPackage.status}
                                      onChange={(e) => updateBidPackage(index, 'status', e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                    >
                                      <option value="to do">To Do</option>
                                      <option value="assigned">Assigned</option>
                                      <option value="in progress">In Progress</option>
                                      <option value="in review">In Review</option>
                                      <option value="bidding">Bidding</option>
                                      <option value="bidding leveling">Bidding Leveling</option>
                                      <option value="completed">Completed</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
                                  <textarea
                                    value={bidPackage.scope || ''}
                                    onChange={(e) => updateBidPackage(index, 'scope', e.target.value)}
                                    rows={2}
                                    placeholder="Detailed scope of work for this package..."
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Captain</label>
                                    <select
                                      value={bidPackage.captainId || ''}
                                      onChange={(e) => {
                                        const selectedUser = users.find(u => u.id === e.target.value);
                                        updateBidPackage(index, 'captainId', e.target.value);
                                        // Also update captainName for backward compatibility
                                        if (selectedUser) {
                                          updateBidPackage(index, 'captainName', formatUserName(selectedUser));
                                          updateBidPackage(index, 'captain', {
                                            id: selectedUser.id,
                                            userName: selectedUser.userName,
                                            firstName: selectedUser.firstName,
                                            lastName: selectedUser.lastName,
                                            email: selectedUser.email
                                          });
                                        } else {
                                          updateBidPackage(index, 'captainName', '');
                                          updateBidPackage(index, 'captain', null);
                                        }
                                      }}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                      disabled={loadingUsers}
                                    >
                                      <option value="">Select captain...</option>
                                      {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {formatUserName(user)} ({user.role})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                                    <input
                                      type="text"
                                      value={bidPackage.location || ''}
                                      onChange={(e) => updateBidPackage(index, 'location', e.target.value)}
                                      placeholder="Package location"
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-zinc-400/20 focus:border-zinc-400 bg-white"
                                    />
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-gray-300">
                                  <button
                                    onClick={() => onBidPackageSelect(bidPackage)}
                                    className="text-xs text-zinc-600 hover:text-zinc-800 font-medium"
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
                                  <div className="relative">
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCaptainSelectorOpen(captainSelectorOpen === bidPackage.id ? null : bidPackage.id);
                                      }}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-zinc-400 transition-all ${
                                        bidPackage.captainId || bidPackage.captainName
                                          ? 'bg-zinc-900 text-white'
                                          : 'bg-gray-200 text-gray-500'
                                      }`}
                                      title={getCaptainName(bidPackage) || 'Click to assign captain'}
                                    >
                                      {getCaptainInitials(bidPackage)}
                                    </div>
                                    {captainSelectorOpen === bidPackage.id && (
                                      <div className="absolute right-0 top-10 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                                        <div className="py-1">
                                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                                            Assign Captain
                                          </div>
                                          {loadingUsers ? (
                                            <div className="px-3 py-4 text-center">
                                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-900 mx-auto"></div>
                                              <p className="text-xs text-gray-500 mt-2">Loading users...</p>
                                            </div>
                                          ) : users.length > 0 ? (
                                            users.map((user) => (
                                              <button
                                                key={user.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCaptainAssignment(bidPackage.id, user.id);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                                              >
                                                <div className="font-medium text-zinc-900">{formatUserName(user)}</div>
                                                <div className="text-xs text-gray-500">{user.role}</div>
                                              </button>
                                            ))
                                          ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">No users available</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>


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

                              {/* Progress Percentage */}
                              <div>
                                {(() => {
                                  const percentage = getApprovalPercentage(bidPackage);
                                  const counts = getApprovalCounts(bidPackage);
                                  return (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600">Progress</span>
                                        <span className="text-xs font-semibold text-zinc-900">{counts.approved}/{counts.total}</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className={`h-full transition-all duration-300 rounded-full ${
                                            percentage === 100 ? 'bg-emerald-500' : 'bg-zinc-900'
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
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
                            <div className="relative">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCaptainSelectorOpen(captainSelectorOpen === bidPackage.id ? null : bidPackage.id);
                                }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-zinc-400 transition-all ${
                                  bidPackage.captainId || bidPackage.captainName
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                                title={getCaptainName(bidPackage) || 'Click to assign captain'}
                              >
                                {getCaptainInitials(bidPackage)}
                              </div>
                              {captainSelectorOpen === bidPackage.id && (
                                <div className="absolute right-0 top-10 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                                  <div className="py-1">
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                                      Assign Captain
                                    </div>
                                    {loadingUsers ? (
                                      <div className="px-3 py-4 text-center">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-900 mx-auto"></div>
                                        <p className="text-xs text-gray-500 mt-2">Loading users...</p>
                                      </div>
                                    ) : users.length > 0 ? (
                                      users.map((user) => (
                                        <button
                                          key={user.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCaptainAssignment(bidPackage.id, user.id);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                                        >
                                          <div className="font-medium text-zinc-900">{formatUserName(user)}</div>
                                          <div className="text-xs text-gray-500">{user.role}</div>
                                        </button>
                                      ))
                                    ) : (
                                      <div className="px-3 py-2 text-sm text-gray-500">No users available</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>


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

                        {/* Progress Percentage */}
                        <div>
                          {(() => {
                            const percentage = getApprovalPercentage(bidPackage);
                            const counts = getApprovalCounts(bidPackage);
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600">Progress</span>
                                  <span className="text-xs font-semibold text-zinc-900">{counts.approved}/{counts.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 rounded-full ${
                                      percentage === 100 ? 'bg-emerald-500' : 'bg-zinc-900'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
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
