'use client';

/**
 * Main Application Page
 * BuildingConnected project management with authentication and RBAC
 */

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import BuildingConnectedProjectList from '@/components/BuildingConnectedProjectList';
import BidPackageListView from '@/components/BidPackageListView';
import BidPackageWorkspace from '@/components/BidPackageWorkspace';
import DiagramUpload from '@/components/DiagramUpload';
import CSIMasterFormatView from '@/components/CSIMasterFormatView';
import Avatar from '@/components/Avatar';
import LeftMenuPanel from '@/components/LeftMenuPanel';
import ChatPanel from '@/components/ChatPanel';
import ProjectCreationView from '@/components/ProjectCreationView';
import ProjectReviewView from '@/components/ProjectReviewView';
import UserManagementView from '@/components/UserManagementView';
import Breadcrumbs from '@/components/Breadcrumbs';
import { LineItem } from '@/components/BidFormTable';
import { ChatMessage } from '@/types/chat';
import { UserPublic } from '@/types/user';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';
import { Diagram } from '@/types/diagram';
import { generateId } from '@/lib/generateId';

type ViewMode = 'projects' | 'packages' | 'workspace' | 'upload' | 'reviewing' | 'creating' | 'project-review' | 'users' | 'csi';
type AuthMode = 'login' | 'register';

// Extended BidPackage with workspace data
interface BidPackageWorkspaceData extends BidPackage {
  lineItems: LineItem[];
  chatMessages: ChatMessage[];
  chatOpen: boolean;
}

export default function Home() {
  // Router for navigation
  const router = useRouter();

  // Authentication state
  const [currentUser, setCurrentUser] = useState<UserPublic | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Application state
  const [bcProjects, setBcProjects] = useState<BuildingConnectedProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<BuildingConnectedProject | null>(null);
  const [selectedBidPackage, setSelectedBidPackage] = useState<BidPackageWorkspaceData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('projects');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Document review state
  const [pendingDiagram, setPendingDiagram] = useState<Diagram | null>(null);
  const [categorization, setCategorization] = useState<any>(null);
  const [isCategorizingDocument, setIsCategorizingDocument] = useState(false);
  const [isProcessingCategory, setIsProcessingCategory] = useState(false);

  // Workspace state
  const [extracting, setExtracting] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [globalChatOpen, setGlobalChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Project creation workflow state
  const [projectCreationData, setProjectCreationData] = useState<any>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load projects from database when user is authenticated
  useEffect(() => {
    if (currentUser) {
      loadProjects();
    }
  }, [currentUser]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Handle clicks outside the sidebar to minimize it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the left menu panel
      if (!target.closest('.left-menu-panel')) {
        setSidebarCollapsed(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setBcProjects(data.projects || []);
        return data.projects || []; // Return the projects data
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
    return []; // Return empty array on error
  };

  const handleLogin = async (user: UserPublic) => {
    setCurrentUser(user);
  };

  const handleRegisterSuccess = () => {
    setAuthMode('login');
    alert('Account created successfully! Please sign in.');
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');

      // Call logout API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Logout API failed:', await response.text());
      } else {
        console.log('Logout API succeeded');
      }

      // Clear all application state
      setCurrentUser(null);
      setSelectedProject(null);
      setSelectedBidPackage(null);
      setViewMode('projects');
      setBcProjects([]);
      setUserMenuOpen(false);
      setIsCheckingAuth(false);
      setAuthMode('login');

      console.log('Logged out successfully - state cleared');

      // Use router to refresh the page (better for Next.js)
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if API fails
      setCurrentUser(null);
      setUserMenuOpen(false);
      setIsCheckingAuth(false);
      setAuthMode('login');
      router.refresh();
    }
  };

  const handleProjectSelect = (project: BuildingConnectedProject) => {
    setSelectedProject(project);
    setViewMode('packages');
  };

  const handleBidPackageSelect = (bidPackage: BidPackage) => {
    // Initialize workspace data for bid package
    let lineItems: LineItem[] = [];
    let chatMessages: ChatMessage[] = [];

    // Try to load workspace data if it exists
    if (bidPackage.workspaceData) {
      try {
        const parsed = JSON.parse(bidPackage.workspaceData as string);
        if (parsed.lineItems) {
          lineItems = parsed.lineItems;
        }
        if (parsed.chatMessages) {
          chatMessages = parsed.chatMessages;
        }
      } catch (e) {
        console.error('Failed to parse workspace data:', e);
      }
    }

    // If no workspace data, load line items from bid forms
    if (lineItems.length === 0) {
      lineItems = bidPackage.bidForms?.flatMap(bf =>
        bf.lineItems?.map(li => ({
          id: li.id,
          item_number: li.itemNumber,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unit_price: li.unitPrice,
          total_price: li.totalPrice,
          notes: li.notes,
          verified: li.verified,
          csiCode: li.csiCode,
          csiTitle: li.csiTitle,
        })) || []
      ) || [];
    }

    const workspaceData: BidPackageWorkspaceData = {
      ...bidPackage,
      lineItems,
      chatMessages,
      chatOpen: false,
    };
    setSelectedBidPackage(workspaceData);
    setViewMode('workspace');
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setSelectedBidPackage(null);
    setViewMode('projects');
  };

  const handleBackToPackages = () => {
    setSelectedBidPackage(null);
    setViewMode('packages');
  };

  const handleProjectUpdate = (updatedProject: BuildingConnectedProject, updatedBidPackages: BidPackage[]) => {
    // Update the project in bcProjects array
    setBcProjects(prev => prev.map(p =>
      p.id === updatedProject.id
        ? { ...updatedProject, bidPackages: updatedBidPackages }
        : p
    ));

    // Update selectedProject
    setSelectedProject({ ...updatedProject, bidPackages: updatedBidPackages });
  };

  const handleUploadNew = () => {
    setViewMode('upload');
  };

  const handleUploadSuccess = async (uploadResult: any) => {
    if (!selectedProject || !uploadResult.diagram) return;

    const diagram = uploadResult.diagram;

    // Reload project to get updated diagrams from database
    await loadProjects();

    // Update selected project with new data
    const updatedProject = bcProjects.find(p => p.id === selectedProject.id);
    if (updatedProject) {
      setSelectedProject(updatedProject);
    }

    // Immediately switch to reviewing view and show the document
    setPendingDiagram(diagram);
    setViewMode('reviewing');
    setIsCategorizingDocument(true);

    // Start AI categorization process in the background
    try {
      const response = await fetch('/api/ai/categorize-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: diagram.fileUrl,
          fileName: diagram.fileName,
          fileType: diagram.fileType
        })
      });

      if (response.ok) {
        const categorizationResult = await response.json();
        setCategorization(categorizationResult);
      } else {
        console.error('Categorization failed');
        alert('Failed to categorize document. Please try again.');
        setPendingDiagram(null);
        setViewMode('packages');
      }
    } catch (error) {
      console.error('Error categorizing document:', error);
      alert('Error categorizing document. Please try again.');
      setPendingDiagram(null);
      setViewMode('packages');
    } finally {
      setIsCategorizingDocument(false);
    }
  };

  const handleCategoryConfirm = async (selectedCategory: string) => {
    if (!pendingDiagram || !selectedProject) return;

    setIsProcessingCategory(true);

    try {
      // Create or find bid package for this category
      const bcBidPackageId = `${selectedProject.bcProjectId}-${selectedCategory.replace(/\s+/g, '-').toLowerCase()}`;

      // Check if bid package exists
      let bidPackage = selectedProject.bidPackages?.find(bp => bp.name === selectedCategory);

      if (!bidPackage) {
        // Create new bid package
        const createResponse = await fetch('/api/bid-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bcBidPackageId,
            bcProjectId: selectedProject.id,
            name: selectedCategory,
            description: `Bid package for ${selectedCategory}`,
            status: 'draft',
            progress: 0,
            diagramIds: [pendingDiagram.id]
          })
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create bid package');
        }

        const { bidPackage: newBidPackage } = await createResponse.json();
        bidPackage = newBidPackage;
      } else {
        // Update existing bid package to include this diagram
        const existingDiagramIds = bidPackage.diagramIds ? JSON.parse(bidPackage.diagramIds) : [];
        if (!existingDiagramIds.includes(pendingDiagram.id)) {
          existingDiagramIds.push(pendingDiagram.id);

          await fetch(`/api/bid-packages/${bidPackage.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              diagramIds: existingDiagramIds
            })
          });
        }
      }

      // Trigger extraction for this diagram and bid package
      await handleExtractStart(pendingDiagram.fileUrl, undefined, bidPackage.id, pendingDiagram.id);

      // Clear review state
      setPendingDiagram(null);
      setCategorization(null);

      // Reload projects to get updated data
      await loadProjects();

      // Navigate to packages view to show the new/updated bid package
      setViewMode('packages');

    } catch (error) {
      console.error('Error processing category:', error);
      alert('Failed to process document category. Please try again.');
    } finally {
      setIsProcessingCategory(false);
    }
  };

  const handleCategoryCancel = () => {
    setPendingDiagram(null);
    setCategorization(null);
    setViewMode('packages');
  };

  const handleExtractStart = async (url: string, instructions?: string, bidPackageId?: string, diagramId?: string) => {
    setExtracting(true);
    setViewMode('workspace');

    try {
      // Use new extraction API that identifies bid packages based on CSI divisions
      const response = await fetch('/api/extract-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: url,
          instructions,
          projectId: selectedProject?.id, // Pass project ID to create multiple bid packages
          diagramId
        }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();

      // If projectId was provided, bid packages were created in the database
      if (selectedProject?.id && data.createdPackages) {
        const freshProjects = await loadProjects();

        // Update selectedProject with fresh data
        const updatedProject = freshProjects.find(p => p.id === selectedProject?.id);
        if (updatedProject) {
          setSelectedProject(updatedProject);

          // If only one package was created, select it automatically
          if (data.createdPackages.length === 1 && data.createdPackages[0].bidPackage) {
            const createdPackageId = data.createdPackages[0].bidPackage.id;
            const updatedBidPackage = updatedProject.bidPackages?.find(bp => bp.id === createdPackageId);

            if (updatedBidPackage) {
              // Get line items from the bid forms
              const allLineItems = updatedBidPackage.bidForms?.flatMap(bf =>
                bf.lineItems?.map(li => ({
                  id: li.id,
                  item_number: li.itemNumber,
                  description: li.description,
                  quantity: li.quantity,
                  unit: li.unit,
                  unit_price: li.unitPrice,
                  total_price: li.totalPrice,
                  notes: li.notes,
                  verified: li.verified,
                  csiCode: li.csiCode,
                  csiTitle: li.csiTitle,
                })) || []
              ) || [];

              setSelectedBidPackage({
                ...updatedBidPackage,
                lineItems: allLineItems,
              });

              // Ensure we're in workspace mode to see the bid form
              setViewMode('workspace');
            }
          } else if (data.createdPackages.length > 1) {
            // Multiple packages created - show package selection view
            setViewMode('packages');
          }

          // Show success message with package count
          console.log(data.message || `Created ${data.createdPackages.length} bid packages`);
        }
      } else if (data.bid_packages) {
        // No database save - just display the extracted bid packages
        console.log('Extraction complete:', data);
        console.log('Bid packages identified:', data.bid_packages.length);

        // For now, if we have bid packages but no database save, just log them
        data.bid_packages.forEach((pkg: any) => {
          console.log(`- ${pkg.name}: ${pkg.line_items?.length || 0} items`);
        });

        // If you want to display the first package locally (without saving to DB):
        if (data.bid_packages.length > 0 && selectedBidPackage) {
          const firstPackage = data.bid_packages[0];
          const lineItemsWithIds = (firstPackage.line_items || []).map((item: LineItem) => ({
            ...item,
            id: item.id || generateId(),
          }));

          setSelectedBidPackage({
            ...selectedBidPackage,
            name: firstPackage.name,
            description: firstPackage.description,
            lineItems: lineItemsWithIds,
          });
        }
      }
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract bid data from diagram');
    } finally {
      setExtracting(false);
    }
  };

  const handleLineItemsUpdate = async (updatedItems: LineItem[]) => {
    if (selectedBidPackage) {
      // Update local state immediately
      setSelectedBidPackage({
        ...selectedBidPackage,
        lineItems: updatedItems,
      });

      // Persist to database - only send workspace data
      try {
        const response = await fetch(`/api/bid-packages/${selectedBidPackage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineItems: updatedItems,
            chatMessages: selectedBidPackage.chatMessages,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Failed to save bid package updates:', errorData);
        }
      } catch (error) {
        console.error('Error saving bid package:', error);
      }
    }
  };

  const handleChatToggle = () => {
    if (selectedBidPackage) {
      setSelectedBidPackage({
        ...selectedBidPackage,
        chatOpen: !selectedBidPackage.chatOpen,
      });
    }
  };

  const handleSubmitToReview = () => {
    if (!selectedBidPackage || !selectedProject) return;

    // Update the bid package status to pending-review and assign to precon leader
    const updatedBidPackage: BidPackageWorkspaceData = {
      ...selectedBidPackage,
      status: 'pending-review',
      assignedTo: 'Precon Leader', // Assigning to precon leader
    };

    // Update the selected bid package
    setSelectedBidPackage(updatedBidPackage);

    // Update the bid package in the project's bid packages array
    const updatedBidPackages = selectedProject.bidPackages?.map(bp =>
      bp.id === selectedBidPackage.id
        ? { ...bp, status: 'pending-review', assignedTo: 'Precon Leader' }
        : bp
    ) || [];

    // Update the project with the modified bid packages
    const updatedProject: BuildingConnectedProject = {
      ...selectedProject,
      bidPackages: updatedBidPackages,
    };

    // Update the project in the projects list
    setBcProjects(prev => prev.map(p =>
      p.id === selectedProject.id ? updatedProject : p
    ));

    // Update the selected project
    setSelectedProject(updatedProject);

    // Show a success message (could be a toast notification in the future)
    console.log('Bid package submitted for review and assigned to Precon Leader');
  };

  const handleRecall = () => {
    if (!selectedBidPackage || !selectedProject) return;

    // Update the bid package status to active (In Progress) and clear assignment
    const updatedBidPackage: BidPackageWorkspaceData = {
      ...selectedBidPackage,
      status: 'active',
      assignedTo: undefined, // Clear assignment
    };

    // Update the selected bid package
    setSelectedBidPackage(updatedBidPackage);

    // Update the bid package in the project's bid packages array
    const updatedBidPackages = selectedProject.bidPackages?.map(bp =>
      bp.id === selectedBidPackage.id
        ? { ...bp, status: 'active', assignedTo: undefined }
        : bp
    ) || [];

    // Update the project with the modified bid packages
    const updatedProject: BuildingConnectedProject = {
      ...selectedProject,
      bidPackages: updatedBidPackages,
    };

    // Update the project in the projects list
    setBcProjects(prev => prev.map(p =>
      p.id === selectedProject.id ? updatedProject : p
    ));

    // Update the selected project
    setSelectedProject(updatedProject);

    // Show a success message (could be a toast notification in the future)
    console.log('Bid package recalled from review and returned to In Progress');
  };

  const handleSendChatMessage = async (message: string) => {
    if (!selectedBidPackage) return;

    setChatLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setSelectedBidPackage({
      ...selectedBidPackage,
      chatMessages: [...selectedBidPackage.chatMessages, userMessage],
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          imageUrl: selectedBidPackage.diagramUrl,
          currentLineItems: selectedBidPackage.lineItems,
          projectName: selectedBidPackage.name,
          conversationHistory: selectedBidPackage.chatMessages,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        proposedChanges: data.proposedChanges,
      };

      setSelectedBidPackage((prev) =>
        prev
          ? {
              ...prev,
              chatMessages: [...prev.chatMessages, assistantMessage],
            }
          : null
      );
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now(),
      };

      setSelectedBidPackage((prev) =>
        prev
          ? {
              ...prev,
              chatMessages: [...prev.chatMessages, errorMessage],
            }
          : null
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptChatChanges = async (messageId: string) => {
    if (!selectedBidPackage) return;

    const message = selectedBidPackage.chatMessages.find((m) => m.id === messageId);
    if (!message?.proposedChanges) return;

    // Apply proposed changes
    let updatedItems = [...selectedBidPackage.lineItems];

    message.proposedChanges.forEach((change) => {
      if (change.type === 'add' && change.newItem) {
        updatedItems.push({ ...change.newItem, id: change.newItem.id || generateId() });
      } else if (change.type === 'update' && change.itemId && change.newItem) {
        updatedItems = updatedItems.map((item) =>
          item.id === change.itemId ? { ...item, ...change.newItem } : item
        );
      } else if (change.type === 'delete' && change.itemId) {
        updatedItems = updatedItems.filter((item) => item.id !== change.itemId);
      }
    });

    // Update local state
    const updatedPackage = {
      ...selectedBidPackage,
      lineItems: updatedItems,
      chatMessages: selectedBidPackage.chatMessages.map((m) =>
        m.id === messageId ? { ...m, changesAccepted: true } : m
      ),
    };

    setSelectedBidPackage(updatedPackage);

    // Persist to database - only send workspace data
    try {
      const response = await fetch(`/api/bid-packages/${selectedBidPackage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: updatedItems,
          chatMessages: updatedPackage.chatMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to save bid package after accepting chat changes:', errorData);
      }
    } catch (error) {
      console.error('Error saving bid package:', error);
    }
  };

  const handleRejectChatChanges = (messageId: string) => {
    if (!selectedBidPackage) return;

    setSelectedBidPackage({
      ...selectedBidPackage,
      chatMessages: selectedBidPackage.chatMessages.map((m) =>
        m.id === messageId ? { ...m, changesRejected: true } : m
      ),
    });
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Navigate back to projects list
      handleBackToProjects();

      // Reload projects to remove the deleted one
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  // Project creation handlers
  const handleNewProject = () => {
    setViewMode('creating');
  };

  const handleProjectCreationContinue = (data: any) => {
    setProjectCreationData(data);
    setViewMode('project-review');
  };

  const handleProjectCreationCancel = () => {
    setProjectCreationData(null);
    setViewMode('projects');
  };

  const handleProjectApprove = async (projectData: any) => {
    try {
      console.log('Creating project with data:', projectData);

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const data = await response.json();
        const createdProjectId = data.project?.id;
        console.log('Project created with ID:', createdProjectId);

        // If project has pre-extracted bid packages data, create them directly in DB
        if (createdProjectId && projectData.extractedBidPackagesData && projectData.extractedBidPackagesData.length > 0) {
          console.log('Using pre-extracted bid packages data. Creating bid packages in database...');

          let firstCreatedBidPackageId: string | null = null;

          // Create bid packages from pre-extracted data
          for (const extractionResult of projectData.extractedBidPackagesData) {
            try {
              const extractData = extractionResult.extractionData;
              const diagramId = extractionResult.diagramId;

              // Create bid packages for each CSI division
              if (extractData.bid_packages && extractData.bid_packages.length > 0) {
                for (const pkg of extractData.bid_packages) {
                  // Skip empty packages
                  if (!pkg.line_items || pkg.line_items.length === 0) {
                    console.log(`Skipping empty package: ${pkg.name}`);
                    continue;
                  }

                  // Create bid package
                  const bidPackageResponse = await fetch('/api/bid-packages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bcBidPackageId: `${createdProjectId}-${pkg.csi_division}-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                      bcProjectId: createdProjectId,
                      name: pkg.name,
                      description: pkg.description || `${pkg.name} scope of work`,
                      scope: pkg.description,
                      status: 'draft',
                      progress: 0,
                      diagramIds: diagramId ? [diagramId] : [],
                      lineItems: pkg.line_items.map((item: any, index: number) => ({
                        itemNumber: item.item_number || null,
                        description: item.description,
                        quantity: item.quantity || null,
                        unit: item.unit || null,
                        unitPrice: item.unit_price || null,
                        totalPrice: item.total_price || null,
                        notes: item.notes || null,
                        order: index,
                        verified: false,
                        csiCode: item.csiCode || 'N/A',
                        csiTitle: item.csiTitle || 'N/A',
                      }))
                    })
                  });

                  if (bidPackageResponse.ok) {
                    const bidPackageData = await bidPackageResponse.json();
                    console.log(`Created bid package: ${pkg.name}`);

                    // Store first created bid package ID for navigation
                    if (!firstCreatedBidPackageId && bidPackageData.bidPackage) {
                      firstCreatedBidPackageId = bidPackageData.bidPackage.id;
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error creating bid package:', error);
            }
          }

          // Reload projects to get fresh data
          const freshProjects = await loadProjects();
          setProjectCreationData(null);

          // Find the created project and navigate to packages view to show all bid packages
          const createdProject = freshProjects?.find((p: BuildingConnectedProject) => p.id === createdProjectId);
          if (createdProject) {
            setSelectedProject(createdProject);
            // Show packages view so user can select which bid package to work on
            setViewMode('packages');
          } else {
            // Fallback to projects view if we can't find the project
            setViewMode('projects');
          }
        } else {
          console.log('No pre-extracted data. Proceeding without bid packages.');
          // No extraction data available, just go to projects view
          await loadProjects();
          setProjectCreationData(null);
          setViewMode('projects');
        }
      } else {
        const error = await response.json();
        console.error('Project creation failed:', error);
        alert(`Failed to create project: ${error.error}`);
      }
    } catch (error) {
      console.error('Project creation error:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!currentUser) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image src="/logo.svg" alt="Logo" width={32} height={32} />
                <h1 className="text-xl font-bold text-zinc-900">Cosmo</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          {authMode === 'login' ? (
            <LoginForm
              onSuccess={handleLogin}
              onSwitchToRegister={() => setAuthMode('register')}
            />
          ) : (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => setAuthMode('login')}
            />
          )}
        </div>
      </div>
    );
  }

  // Handle left menu item clicks
  const handleMenuItemClick = (item: string) => {
    if (item === 'chat') {
      // If in workspace, toggle workspace chat
      if (selectedBidPackage) {
        handleChatToggle();
      } else {
        // Otherwise toggle global chat
        setGlobalChatOpen(!globalChatOpen);
      }
    } else if (item === 'users') {
      // Show user management view
      setViewMode('users');
      setSelectedProject(null);
      setSelectedBidPackage(null);
    } else if (item === 'csi') {
      // Show CSI MasterFormat view
      setViewMode('csi');
      setSelectedProject(null);
      setSelectedBidPackage(null);
    } else if (item === 'projects') {
      // Return to projects view
      setViewMode('projects');
      setSelectedProject(null);
      setSelectedBidPackage(null);
    } else {
      console.log('Menu item clicked:', item);
    }
  };

  // Determine if chat should be shown as active
  const isChatActive = selectedBidPackage?.chatOpen || globalChatOpen;

  // Determine active menu item
  const getActiveMenuItem = () => {
    if (isChatActive) return 'chat';
    if (viewMode === 'users') return 'users';
    if (viewMode === 'csi') return 'csi';
    return 'projects';
  };

  // Main application
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Menu Panel */}
      <LeftMenuPanel
        activeItem={getActiveMenuItem()}
        onItemClick={handleMenuItemClick}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10 h-[68px]">
          <div className="px-6 h-full flex items-center justify-between">
            {/* Breadcrumbs */}
            <Breadcrumbs
              viewMode={viewMode}
              selectedProject={selectedProject}
              selectedBidPackage={selectedBidPackage}
              onNavigateToProjects={handleBackToProjects}
              onNavigateToPackages={handleBackToPackages}
            />

            {/* User Menu */}
            <div className="flex items-center">
              <div className="relative user-menu-container">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  firstName={currentUser.firstName}
                  lastName={currentUser.lastName}
                  avatarUrl={currentUser.avatarUrl}
                  size="medium"
                />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-zinc-900">
                      {currentUser.firstName && currentUser.lastName
                        ? `${currentUser.firstName} ${currentUser.lastName}`
                        : currentUser.userName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {currentUser.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        handleLogout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-zinc-900 transition-colors flex items-center space-x-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {viewMode === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <BuildingConnectedProjectList
                projects={bcProjects}
                onProjectSelect={handleProjectSelect}
                onNewProject={handleNewProject}
              />
            </motion.div>
          )}

          {viewMode === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <UserManagementView currentUser={currentUser} />
            </motion.div>
          )}

          {viewMode === 'csi' && (
            <motion.div
              key="csi"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <CSIMasterFormatView />
            </motion.div>
          )}

          {viewMode === 'packages' && selectedProject && (
            <motion.div
              key="packages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <BidPackageListView
                project={selectedProject}
                bidPackages={selectedProject.bidPackages || []}
                onBidPackageSelect={handleBidPackageSelect}
                onBack={handleBackToProjects}
                onUploadDiagrams={handleUploadNew}
                onUploadSuccess={handleUploadSuccess}
                onProjectUpdate={handleProjectUpdate}
                onSaveComplete={loadProjects}
              />
            </motion.div>
          )}

          {viewMode === 'workspace' && selectedBidPackage && selectedProject && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <BidPackageWorkspace
                bidPackage={selectedBidPackage}
                project={selectedProject}
                projectDiagrams={selectedProject.diagrams || []}
                lineItems={selectedBidPackage.lineItems || []}
                isExtracting={extracting}
                onLineItemsUpdate={handleLineItemsUpdate}
                onUploadNew={handleUploadNew}
                onUploadSuccess={handleUploadSuccess}
                onBack={handleBackToPackages}
                chatOpen={selectedBidPackage.chatOpen || false}
                chatMessages={selectedBidPackage.chatMessages || []}
                onChatToggle={handleChatToggle}
                onSendChatMessage={handleSendChatMessage}
                onAcceptChatChanges={handleAcceptChatChanges}
                onRejectChatChanges={handleRejectChatChanges}
                isChatLoading={chatLoading}
                onSubmitToReview={handleSubmitToReview}
                onRecall={handleRecall}
                onDeleteProject={handleDeleteProject}
              />
            </motion.div>
          )}

          {viewMode === 'upload' && selectedProject && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full flex items-center justify-center"
            >
              <DiagramUpload
                bcProjectId={selectedProject.id}
                onUploadSuccess={handleUploadSuccess}
                onExtractStart={handleExtractStart}
                onCancel={() => setViewMode(selectedBidPackage ? 'workspace' : 'packages')}
              />
            </motion.div>
          )}

          {viewMode === 'reviewing' && pendingDiagram && (
            <motion.div
              key="reviewing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <DocumentReviewView
                diagram={pendingDiagram}
                categorization={categorization}
                isProcessing={isCategorizingDocument || isProcessingCategory}
                onConfirm={handleCategoryConfirm}
                onCancel={handleCategoryCancel}
              />
            </motion.div>
          )}

          {viewMode === 'creating' && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ProjectCreationView
                onBack={handleProjectCreationCancel}
                onContinue={handleProjectCreationContinue}
              />
            </motion.div>
          )}

          {viewMode === 'project-review' && projectCreationData && (
            <motion.div
              key="project-review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ProjectReviewView
                mode={projectCreationData.mode}
                platform={projectCreationData.platform}
                uploadedDocuments={projectCreationData.uploadedDocuments}
                selectedExternalProject={projectCreationData.selectedExternalProject}
                onApprove={handleProjectApprove}
                onCancel={handleProjectCreationCancel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

        {/* Global Chat Panel */}
        {globalChatOpen && (
          <div className="fixed right-0 top-0 bottom-0 w-96 z-50 shadow-2xl">
            <ChatPanel
              diagramUrl={null}
              currentLineItems={[]}
              projectName="General Chat"
              messages={[]}
              onSendMessage={(message) => {
                console.log('Global chat message:', message);
                // TODO: Implement global chat API call
              }}
              onAcceptChanges={() => {}}
              onRejectChanges={() => {}}
              onClose={() => setGlobalChatOpen(false)}
              isLoading={false}
            />
          </div>
        )}

      </div>
    </div>
  );
}
