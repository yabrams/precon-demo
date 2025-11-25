'use client';

/**
 * Bid Package Workspace Page
 * /projects/:projectId/packages/:packageId route
 * Query params: ?chat=true&view=single|grid&item=N&diagram=id
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BidPackageWorkspace from '@/components/BidPackageWorkspace';
import { BuildingConnectedProject } from '@/types/buildingconnected';
import { BidPackage } from '@/types/bidPackage';
import { LineItem } from '@/components/BidFormTable';
import { ChatMessage } from '@/types/chat';
import { generateId } from '@/lib/generateId';
import { useWorkspaceParams } from '@/hooks/useWorkspaceParams';

interface BidPackageWorkspaceData extends BidPackage {
  lineItems: LineItem[];
  chatMessages: ChatMessage[];
  chatOpen: boolean;
}

interface PageProps {
  params: Promise<{ projectId: string; packageId: string }>;
}

export default function WorkspacePage({ params }: PageProps) {
  const { projectId, packageId } = use(params);
  const router = useRouter();
  const { params: workspaceParams, setChatOpen, setViewMode, setCurrentItem, setDiagram } = useWorkspaceParams();

  const [project, setProject] = useState<BuildingConnectedProject | null>(null);
  const [bidPackage, setBidPackage] = useState<BidPackageWorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, packageId]);

  // Sync chat state from URL
  useEffect(() => {
    if (bidPackage && bidPackage.chatOpen !== workspaceParams.chat) {
      setBidPackage(prev => prev ? { ...prev, chatOpen: workspaceParams.chat } : null);
    }
  }, [workspaceParams.chat]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch project and bid package in parallel
      const [projectRes, packageRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/bid-packages/${packageId}`),
      ]);

      if (!projectRes.ok) {
        setError('Project not found');
        return;
      }

      if (!packageRes.ok) {
        setError('Bid package not found');
        return;
      }

      const projectData = await projectRes.json();
      const packageData = await packageRes.json();

      setProject(projectData.project);

      // Initialize workspace data for bid package
      const pkg = packageData.bidPackage;
      let lineItems: LineItem[] = [];
      let chatMessages: ChatMessage[] = [];

      // Try to load workspace data if it exists
      if (pkg.workspaceData) {
        try {
          const parsed = typeof pkg.workspaceData === 'string'
            ? JSON.parse(pkg.workspaceData)
            : pkg.workspaceData;
          if (parsed.lineItems) lineItems = parsed.lineItems;
          if (parsed.chatMessages) chatMessages = parsed.chatMessages;
        } catch (e) {
          console.error('Failed to parse workspace data:', e);
        }
      }

      // If no workspace data, load line items from bid forms
      if (lineItems.length === 0 && pkg.bidForms) {
        lineItems = pkg.bidForms.flatMap((bf: any) =>
          bf.lineItems?.map((li: any) => ({
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
        );
      }

      setBidPackage({
        ...pkg,
        lineItems,
        chatMessages,
        chatOpen: workspaceParams.chat,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLineItemsUpdate = useCallback(async (updatedItems: LineItem[]) => {
    if (!bidPackage) return;

    // Update local state immediately
    setBidPackage(prev => prev ? { ...prev, lineItems: updatedItems } : null);

    // Persist to database
    try {
      await fetch(`/api/bid-packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: updatedItems,
          chatMessages: bidPackage.chatMessages,
        }),
      });
    } catch (error) {
      console.error('Error saving bid package:', error);
    }
  }, [bidPackage, packageId]);

  const handleChatToggle = useCallback(() => {
    const newChatOpen = !bidPackage?.chatOpen;
    setChatOpen(newChatOpen);
    setBidPackage(prev => prev ? { ...prev, chatOpen: newChatOpen } : null);
  }, [bidPackage, setChatOpen]);

  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!bidPackage) return;

    setChatLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setBidPackage(prev => prev ? {
      ...prev,
      chatMessages: [...prev.chatMessages, userMessage],
    } : null);

    // Get diagram URL from project diagrams
    const diagramUrl = project?.diagrams?.[0]?.fileUrl || null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          imageUrl: diagramUrl,
          currentLineItems: bidPackage.lineItems,
          projectName: bidPackage.name,
          conversationHistory: bidPackage.chatMessages,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        proposedChanges: data.proposedChanges,
      };

      setBidPackage(prev => prev ? {
        ...prev,
        chatMessages: [...prev.chatMessages, assistantMessage],
      } : null);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now(),
      };

      setBidPackage(prev => prev ? {
        ...prev,
        chatMessages: [...prev.chatMessages, errorMessage],
      } : null);
    } finally {
      setChatLoading(false);
    }
  }, [bidPackage]);

  const handleAcceptChatChanges = useCallback(async (messageId: string) => {
    if (!bidPackage) return;

    const message = bidPackage.chatMessages.find(m => m.id === messageId);
    if (!message?.proposedChanges) return;

    let updatedItems = [...bidPackage.lineItems];

    message.proposedChanges.forEach(change => {
      if (change.type === 'add' && change.newItem) {
        updatedItems.push({ ...change.newItem, id: change.newItem.id || generateId() });
      } else if (change.type === 'update' && change.itemId && change.newItem) {
        updatedItems = updatedItems.map(item =>
          item.id === change.itemId ? { ...item, ...change.newItem } : item
        );
      } else if (change.type === 'delete' && change.itemId) {
        updatedItems = updatedItems.filter(item => item.id !== change.itemId);
      }
    });

    const updatedChatMessages = bidPackage.chatMessages.map(m =>
      m.id === messageId ? { ...m, changesAccepted: true } : m
    );

    setBidPackage(prev => prev ? {
      ...prev,
      lineItems: updatedItems,
      chatMessages: updatedChatMessages,
    } : null);

    // Persist to database
    try {
      await fetch(`/api/bid-packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: updatedItems,
          chatMessages: updatedChatMessages,
        }),
      });
    } catch (error) {
      console.error('Error saving bid package:', error);
    }
  }, [bidPackage, packageId]);

  const handleRejectChatChanges = useCallback((messageId: string) => {
    if (!bidPackage) return;

    setBidPackage(prev => prev ? {
      ...prev,
      chatMessages: prev.chatMessages.map(m =>
        m.id === messageId ? { ...m, changesRejected: true } : m
      ),
    } : null);
  }, [bidPackage]);

  const handleBack = () => {
    router.push(`/projects/${projectId}`);
  };

  const handleUploadNew = () => {
    router.push(`/projects/${projectId}/upload`);
  };

  const handleUploadSuccess = async (file: any) => {
    await loadData();
    if (file.diagram) {
      router.push(`/projects/${projectId}/review-diagram?diagramId=${file.diagram.id}`);
    }
  };

  const handleSubmitToReview = useCallback(async () => {
    if (!bidPackage) return;

    // Update local state immediately to 'pending-review'
    setBidPackage(prev => prev ? {
      ...prev,
      status: 'pending-review' as any, // TypeScript workaround for status
    } : null);

    try {
      await fetch(`/api/bid-packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending-review',
          assignedTo: 'Precon Leader',
        }),
      });
    } catch (error) {
      console.error('Error submitting for review:', error);
    }
  }, [bidPackage, packageId]);

  const handleRecall = useCallback(async () => {
    if (!bidPackage) return;

    setBidPackage(prev => prev ? {
      ...prev,
      status: 'active' as const,
    } : null);

    try {
      await fetch(`/api/bid-packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          assignedTo: null,
        }),
      });
    } catch (error) {
      console.error('Error recalling:', error);
    }
  }, [bidPackage, packageId]);

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/');
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  }, [project, projectId, router]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-mono">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !project || !bidPackage) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">{error || 'Not found'}</h2>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <BidPackageWorkspace
      bidPackage={bidPackage}
      project={project}
      projectDiagrams={project.diagrams || []}
      lineItems={bidPackage.lineItems}
      isExtracting={extracting}
      onLineItemsUpdate={handleLineItemsUpdate}
      onUploadNew={handleUploadNew}
      onUploadSuccess={handleUploadSuccess}
      onBack={handleBack}
      chatOpen={bidPackage.chatOpen}
      chatMessages={bidPackage.chatMessages}
      onChatToggle={handleChatToggle}
      onSendChatMessage={handleSendChatMessage}
      onAcceptChatChanges={handleAcceptChatChanges}
      onRejectChatChanges={handleRejectChatChanges}
      isChatLoading={chatLoading}
      onSubmitToReview={handleSubmitToReview}
      onRecall={handleRecall}
      onDeleteProject={handleDeleteProject}
    />
  );
}
