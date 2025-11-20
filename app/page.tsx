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
import WorkspaceView from '@/components/WorkspaceView';
import InboxListView from '@/components/InboxListView';
import CSIWidget from '@/components/CSIWidget';
import CSIFloatingButton from '@/components/CSIFloatingButton';
import { LineItem } from '@/components/BidFormTable';
import { ChatMessage } from '@/types/chat';
import { UserPublic } from '@/types/user';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';
import { Diagram } from '@/types/diagram';
import { generateId } from '@/lib/generateId';
import {
  mockBuildingConnectedProjects,
  mockBidPackages,
  getBidPackagesByProject,
} from '@/lib/mockBuildingConnectedData';

type ViewMode = 'projects' | 'packages' | 'workspace' | 'upload';
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
  const [bcProjects, setBcProjects] = useState<BuildingConnectedProject[]>(mockBuildingConnectedProjects);
  const [bidPackages, setBidPackages] = useState<BidPackage[]>(mockBidPackages);
  const [selectedProject, setSelectedProject] = useState<BuildingConnectedProject | null>(null);
  const [selectedBidPackage, setSelectedBidPackage] = useState<BidPackageWorkspaceData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('projects');

  // Workspace state
  const [extracting, setExtracting] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [csiWidgetOpen, setCsiWidgetOpen] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
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

  const handleLogin = async (user: UserPublic, token: string) => {
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
    // Diagrams are now at project level, not bid package level
    const workspaceData: BidPackageWorkspaceData = {
      ...bidPackage,
      lineItems: [],
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

  const handleUploadSuccess = (file: { url: string; fileName: string; fileSize?: number; fileType?: string }) => {
    if (selectedProject) {
      // Create new diagram at project level
      const newDiagram: Diagram = {
        id: generateId(),
        bcProjectId: selectedProject.bcProjectId,
        fileName: file.fileName,
        fileUrl: file.url,
        fileType: file.fileType || 'image/png',
        fileSize: file.fileSize || 0,
        uploadedAt: new Date(),
        uploadedBy: currentUser?.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add diagram to project
      setBcProjects(prev => prev.map(p =>
        p.bcProjectId === selectedProject.bcProjectId
          ? { ...p, diagrams: [...(p.diagrams || []), newDiagram] }
          : p
      ));

      // Update selected project state
      setSelectedProject(prev =>
        prev ? { ...prev, diagrams: [...(prev.diagrams || []), newDiagram] } : null
      );

      // If uploading from within a bid package, associate diagram and extract
      if (selectedBidPackage) {
        setBidPackages(prev => prev.map(pkg =>
          pkg.id === selectedBidPackage.id
            ? { ...pkg, diagramIds: [...(pkg.diagramIds || []), newDiagram.id] }
            : pkg
        ));

        // Trigger extraction automatically for bid package
        handleExtractStart(file.url);
      } else {
        // Just uploading at project level - go back to packages view
        setViewMode('packages');
      }
    }
  };

  const handleExtractStart = async (url: string, instructions?: string) => {
    setExtracting(true);
    setViewMode('workspace');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url, instructions }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();

      // Add unique IDs to line items
      const lineItemsWithIds = (data.line_items || []).map((item: LineItem) => ({
        ...item,
        id: item.id || generateId(),
      }));

      // Update bid package with extracted data
      if (selectedBidPackage) {
        setSelectedBidPackage({
          ...selectedBidPackage,
          lineItems: lineItemsWithIds,
        });
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
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!currentUser) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b flex-shrink-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image src="/logo.svg" alt="Logo" width={32} height={32} />
                <h1 className="text-xl font-bold text-gray-900">Project Cosmo</h1>
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


  const handleCSICodeSelect = (code: string, title: string) => {
    console.log('CSI code selected:', code, title);
    // You can add custom logic here, e.g., copy to clipboard, add to form, etc.
    // For now, just log it
  };
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Image
                src="/logo.svg"
                alt="plan.ai Logo"
                width={120}
                height={40}
              />

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {currentUser.firstName || currentUser.userName}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Sign Out
              </button>
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
                bidPackages={getBidPackagesByProject(selectedProject.bcProjectId)}
                onBidPackageSelect={handleBidPackageSelect}
                onBack={handleBackToProjects}
                onUploadDiagrams={handleUploadNew}
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
                onUploadSuccess={handleUploadSuccess}
                onExtractStart={handleExtractStart}
                onCancel={() => setViewMode(selectedBidPackage ? 'workspace' : 'packages')}
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
