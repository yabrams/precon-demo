'use client';

/**
 * Main Application Page
 * BuildingConnected project management with authentication and RBAC
 */

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import BuildingConnectedProjectList from '@/components/BuildingConnectedProjectList';
import BidPackageListView from '@/components/BidPackageListView';
import BidPackageWorkspace from '@/components/BidPackageWorkspace';
import DiagramUpload from '@/components/DiagramUpload';
import CSIWidget from '@/components/CSIWidget';
import CSIFloatingButton from '@/components/CSIFloatingButton';
import Avatar from '@/components/Avatar';
import DocumentReviewPanel from '@/components/DocumentReviewPanel';
import DocumentReviewView from '@/components/DocumentReviewView';
import { LineItem } from '@/components/BidFormTable';
import { ChatMessage } from '@/types/chat';
import { UserPublic } from '@/types/user';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';
import { Diagram } from '@/types/diagram';
import { generateId } from '@/lib/generateId';

type ViewMode = 'projects' | 'packages' | 'workspace' | 'upload' | 'reviewing';
type AuthMode = 'login' | 'register';

// Extended BidPackage with workspace data
interface BidPackageWorkspaceData extends BidPackage {
  lineItems: LineItem[];
  chatMessages: ChatMessage[];
  chatOpen: boolean;
}

export default function Home() {
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
  const [csiWidgetOpen, setCsiWidgetOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
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
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setSelectedProject(null);
      setSelectedBidPackage(null);
      setViewMode('projects');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProjectSelect = (project: BuildingConnectedProject) => {
    setSelectedProject(project);
    setViewMode('packages');
  };

  const handleBidPackageSelect = (bidPackage: BidPackage) => {
    // Initialize workspace data for bid package
    // Load line items from bid forms
    const allLineItems = bidPackage.bidForms?.flatMap(bf =>
      bf.lineItems?.map(li => ({
        id: li.id,
        item_number: li.itemNumber,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unit_price: li.unitPrice,
        total_price: li.totalPrice,
        notes: li.notes,
        verified: li.verified
      })) || []
    ) || [];

    const workspaceData: BidPackageWorkspaceData = {
      ...bidPackage,
      lineItems: allLineItems,
      chatMessages: [],
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
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: url,
          instructions,
          bidPackageId,
          diagramId
        }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();

      // If bidPackageId was provided, extraction was saved to database
      // Reload projects to get the latest data
      if (bidPackageId) {
        await loadProjects();

        // Update selectedProject with fresh data
        const updatedProject = bcProjects.find(p => p.id === selectedProject?.id);
        if (updatedProject) {
          setSelectedProject(updatedProject);

          // Update selectedBidPackage with the new bid form data
          const updatedBidPackage = updatedProject.bidPackages?.find(bp => bp.id === bidPackageId);
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
                verified: li.verified
              })) || []
            ) || [];

            setSelectedBidPackage({
              ...selectedBidPackage!,
              ...updatedBidPackage,
              lineItems: allLineItems,
            });
          }
        }
      } else {
        // Legacy path - just update local state with extracted data
        const lineItemsWithIds = (data.line_items || []).map((item: LineItem) => ({
          ...item,
          id: item.id || generateId(),
        }));

        if (selectedBidPackage) {
          setSelectedBidPackage({
            ...selectedBidPackage,
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

  const handleLineItemsUpdate = (updatedItems: LineItem[]) => {
    if (selectedBidPackage) {
      setSelectedBidPackage({
        ...selectedBidPackage,
        lineItems: updatedItems,
      });
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

  const handleAcceptChatChanges = (messageId: string) => {
    if (!selectedBidPackage) return;

    const message = selectedBidPackage.chatMessages.find((m) => m.id === messageId);
    if (!message?.proposedChanges) return;

    // Apply proposed changes
    let updatedItems = [...selectedBidPackage.lineItems];

    message.proposedChanges.forEach((change) => {
      if (change.type === 'add') {
        updatedItems.push({ ...change.item, id: change.item.id || generateId() });
      } else if (change.type === 'update' && change.itemId) {
        updatedItems = updatedItems.map((item) =>
          item.id === change.itemId ? { ...item, ...change.item } : item
        );
      } else if (change.type === 'delete' && change.itemId) {
        updatedItems = updatedItems.filter((item) => item.id !== change.itemId);
      }
    });

    setSelectedBidPackage({
      ...selectedBidPackage,
      lineItems: updatedItems,
      chatMessages: selectedBidPackage.chatMessages.map((m) =>
        m.id === messageId ? { ...m, changesAccepted: true } : m
      ),
    });
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

  const handleCSICodeSelect = (code: string, title: string) => {
    console.log('CSI code selected:', code, title);
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-slate-400 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!currentUser) {
    return (
      <div className="h-screen flex flex-col bg-slate-950">
        {/* Header */}
        <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex-shrink-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image src="/logo.svg" alt="Logo" width={32} height={32} />
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">ConstructAI</h1>
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

  // Main application
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Image
                src="/logo.svg"
                alt="ConstructAI Logo"
                width={120}
                height={40}
              />
            </div>

            {/* User Menu */}
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
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-xl shadow-black/20 overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-sm font-semibold text-slate-200">
                      {currentUser.firstName && currentUser.lastName
                        ? `${currentUser.firstName} ${currentUser.lastName}`
                        : currentUser.userName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center space-x-2"
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
              />
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
        </AnimatePresence>
      </main>

      {/* CSI Floating Button */}
      {currentUser && <CSIFloatingButton onClick={() => setCsiWidgetOpen(true)} />}

      {/* CSI Widget */}
      <CSIWidget
        isOpen={csiWidgetOpen}
        onClose={() => setCsiWidgetOpen(false)}
        onSelectCode={handleCSICodeSelect}
      />
    </div>
  );
}
