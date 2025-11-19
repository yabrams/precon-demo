'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DiagramUpload from '@/components/DiagramUpload';
import WorkspaceView from '@/components/WorkspaceView';
import InboxListView from '@/components/InboxListView';
import CSIWidget from '@/components/CSIWidget';
import CSIFloatingButton from '@/components/CSIFloatingButton';
import { LineItem } from '@/components/BidFormTable';
import { ChatMessage } from '@/types/chat';
import { InboxItem } from '@/types/inbox';
import { generateId } from '@/lib/generateId';
import { mockInboxItems, mockInboxLineItems } from '@/lib/mockInboxData';

// Extend Window interface for temporary project ID storage
declare global {
  interface Window {
    __newProjectId?: string;
  }
}

interface Project {
  id: string;
  name: string;
  diagramUrl: string;
  lineItems: LineItem[];
  createdAt: number;
  chatMessages: ChatMessage[];
  chatOpen: boolean;
}

type WorkflowMode = 'inbox' | 'upload' | 'workspace';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('inbox');
  const [showUpload, setShowUpload] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(mockInboxItems);
  const [csiWidgetOpen, setCsiWidgetOpen] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleUploadSuccess = (file: { url: string; fileName: string }) => {
    // Create new project
    const newProject: Project = {
      id: generateId(),
      name: file.fileName.replace(/\.[^/.]+$/, ''),
      diagramUrl: file.url,
      lineItems: [],
      createdAt: Date.now(),
      chatMessages: [],
      chatOpen: false,
    };

    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    // Don't hide upload view yet - wait for extraction to start

    // Store the new project ID for extraction
    window.__newProjectId = newProject.id;
  };

  const handleExtractStart = async (url: string, instructions?: string) => {
    setExtracting(true);
    setShowUpload(false); // Hide upload view when extraction starts

    // Get the project ID that was just created
    const projectIdToUpdate = window.__newProjectId || activeProjectId;

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
      console.log('Received extraction data:', data);
      console.log('Line items received:', data.line_items);
      console.log('Line items length:', data.line_items?.length);
      console.log('Updating project ID:', projectIdToUpdate);

      // Update the correct project with extracted data
      // Add unique IDs to line items if they don't have them
      const lineItemsWithIds = (data.line_items || []).map((item: LineItem) => ({
        ...item,
        id: item.id || generateId(),
      }));

      setProjects((prev) => {
        const updated = prev.map((p) =>
          p.id === projectIdToUpdate
            ? {
                ...p,
                name: data.project_name || p.name,
                lineItems: lineItemsWithIds,
              }
            : p
        );
        console.log('Updated projects:', updated);
        return updated;
      });

      // Clean up the temporary ID
      delete window.__newProjectId;
    } catch (error) {
      console.error('Extraction error:', error);
      alert('Failed to extract bid data from diagram');
    } finally {
      setExtracting(false);
    }
  };

  const handleLineItemsUpdate = (updatedItems: LineItem[]) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, lineItems: updatedItems } : p
      )
    );
  };

  const handleUploadNew = () => {
    setWorkflowMode('upload');
    setShowUpload(true);
  };

  const handleStartUploadFlow = () => {
    setWorkflowMode('upload');
    setShowUpload(true);
  };

  const handleBackToInbox = () => {
    setWorkflowMode('inbox');
    setShowUpload(false);
    setActiveProjectId(null);
  };

  const handleInboxItemSelect = (item: InboxItem) => {
    // Check if this inbox item already has a project
    const existingProject = projects.find(p => p.id === item.projectId);

    if (existingProject) {
      // Load existing project
      setActiveProjectId(existingProject.id);
      setWorkflowMode('workspace');
      setShowUpload(false);
    } else {
      // Create new project from inbox item
      const newProject: Project = {
        id: generateId(),
        name: item.subject,
        diagramUrl: item.diagramUrl,
        lineItems: mockInboxLineItems[item.id] || [],
        createdAt: Date.now(),
        chatMessages: [],
        chatOpen: false,
      };

      // Add project to list
      setProjects((prev) => [...prev, newProject]);
      setActiveProjectId(newProject.id);

      // Update inbox item status and link to project
      setInboxItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: item.status === 'pending' ? 'in_progress' : item.status, projectId: newProject.id }
            : i
        )
      );

      // Navigate to workspace
      setWorkflowMode('workspace');
      setShowUpload(false);
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    setActiveProjectId(projectId);
    setShowUpload(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      setShowUpload(remaining.length === 0);
    }
  };

  const handleStartEditingName = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setEditingName(currentName);
  };

  const handleFinishEditingName = () => {
    if (editingProjectId && editingName.trim()) {
      setProjects((prev) =>
        prev.map((p) => (p.id === editingProjectId ? { ...p, name: editingName.trim() } : p))
      );
    }
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleCancelEditingName = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleChatToggle = () => {
    if (activeProjectId) {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, chatOpen: !p.chatOpen } : p))
      );
    }
  };

  const handleSendChatMessage = async (message: string) => {
    if (!activeProject) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, chatMessages: [...p.chatMessages, userMessage] }
          : p
      )
    );

    setChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          imageUrl: activeProject.diagramUrl,
          currentLineItems: activeProject.lineItems,
          projectName: activeProject.name,
          conversationHistory: activeProject.chatMessages.slice(-10), // Last 10 messages for context
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

      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId
            ? { ...p, chatMessages: [...p.chatMessages, assistantMessage] }
            : p
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };

      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId
            ? { ...p, chatMessages: [...p.chatMessages, errorMessage] }
            : p
        )
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptChatChanges = (messageId: string) => {
    console.log('handleAcceptChatChanges called with messageId:', messageId);

    if (!activeProject) {
      console.log('No active project');
      return;
    }

    const message = activeProject.chatMessages.find((m) => m.id === messageId);
    console.log('Found message:', message);

    if (!message || !message.proposedChanges) {
      console.log('No message or no proposed changes');
      return;
    }

    console.log('Proposed changes:', message.proposedChanges);
    console.log('Current line items count BEFORE changes:', activeProject.lineItems.length);
    let updatedLineItems = [...activeProject.lineItems];

    // Apply each proposed change
    message.proposedChanges.forEach((change, idx) => {
      console.log(`Applying change ${idx}:`, JSON.stringify(change, null, 2));
      console.log(`Change type: "${change.type}"`);
      console.log(`Has newItem:`, !!change.newItem);

      if (change.type === 'add' && change.newItem) {
        console.log('✅ ADDING new item:', change.newItem);
        updatedLineItems.push(change.newItem);
        console.log('Updated line items count after add:', updatedLineItems.length);
      } else if (change.type === 'update' && change.itemId) {
        const index = updatedLineItems.findIndex((item) => item.id === change.itemId);
        console.log(`Found item at index ${index} with id ${change.itemId}`);

        if (index !== -1) {
          // If newItem is provided, use it
          if (change.newItem) {
            console.log('Replacing with newItem:', change.newItem);
            updatedLineItems[index] = change.newItem;
          }
          // Otherwise apply field-by-field changes
          else if (change.changes && change.changes.length > 0) {
            console.log('Applying field changes:', change.changes);
            const updatedItem = { ...updatedLineItems[index] };
            change.changes.forEach((fieldChange) => {
              (updatedItem as any)[fieldChange.field] = fieldChange.newValue;
            });
            updatedLineItems[index] = updatedItem;
          }
        } else {
          console.log('Item not found with id:', change.itemId);
        }
      } else if (change.type === 'delete' && change.itemId) {
        console.log('Deleting item:', change.itemId);
        updatedLineItems = updatedLineItems.filter((item) => item.id !== change.itemId);
      }
    });

    console.log('✅ FINAL Updated line items count:', updatedLineItems.length);
    console.log('✅ FINAL Updated line items:', updatedLineItems);

    // Add acknowledgment message to chat
    const acknowledgmentMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: `✅ Changes accepted! Updated ${message.proposedChanges.length} item(s) in the bid form.`,
      timestamp: Date.now(),
    };

    setProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, lineItems: updatedLineItems, chatMessages: [...p.chatMessages, acknowledgmentMessage] }
          : p
      );
      console.log('✅ Projects state updated. Active project line items count:',
        updated.find(p => p.id === activeProjectId)?.lineItems.length);
      return updated;
    });
  };

  const handleRejectChatChanges = (messageId: string) => {
    console.log('Changes rejected for message:', messageId);

    if (!activeProject) return;

    const message = activeProject.chatMessages.find((m) => m.id === messageId);
    if (!message || !message.proposedChanges) return;

    // Add rejection acknowledgment message to chat
    const acknowledgmentMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: `❌ Changes rejected. The bid form remains unchanged.`,
      timestamp: Date.now(),
    };

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, chatMessages: [...p.chatMessages, acknowledgmentMessage] }
          : p
      )
    );
  };

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
            </div>

            {/* Back to Inbox Button - shown when in workspace or upload mode */}
            {workflowMode !== 'inbox' && (
              <button
                onClick={handleBackToInbox}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Inbox
              </button>
            )}
          </div>
        </div>

        {/* Project Tabs */}
        {projects.length > 0 && (
          <div className="border-t bg-gray-50 px-6">
            <div className="flex gap-2 overflow-x-auto py-2">
              {projects.map((project) => {
                const isEditing = editingProjectId === project.id;
                return (
                  <div
                    key={project.id}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors flex-shrink-0 ${
                      activeProjectId === project.id
                        ? 'bg-white border-blue-600 text-blue-600'
                        : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                    } ${isEditing ? '' : 'cursor-pointer'}`}
                    onClick={() => !isEditing && handleProjectSwitch(project.id)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleFinishEditingName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleFinishEditingName();
                          } else if (e.key === 'Escape') {
                            handleCancelEditingName();
                          }
                        }}
                        className="text-sm font-medium px-2 py-0.5 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="text-sm font-medium truncate max-w-xs cursor-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditingName(project.id, project.name);
                        }}
                      >
                        {project.name}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showUpload ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full flex items-center justify-center p-8"
            >
              <div className="w-full max-w-3xl">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8 text-center"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    {projects.length === 0
                      ? 'Get Started'
                      : 'Upload Another Diagram'}
                  </h2>
                  <p className="text-gray-600">
                    Upload a construction diagram to extract bid items automatically
                  </p>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <DiagramUpload
                    onUploadSuccess={handleUploadSuccess}
                    onExtractStart={handleExtractStart}
                  />
                </motion.div>
              </div>
            </motion.div>
          ) : activeProject ? (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <WorkspaceView
                diagramUrl={activeProject.diagramUrl}
                lineItems={activeProject.lineItems}
                isExtracting={extracting}
                onLineItemsUpdate={handleLineItemsUpdate}
                onUploadNew={handleUploadNew}
                projectName={activeProject.name}
                chatOpen={activeProject.chatOpen}
                chatMessages={activeProject.chatMessages}
                onChatToggle={handleChatToggle}
                onSendChatMessage={handleSendChatMessage}
                onAcceptChatChanges={handleAcceptChatChanges}
                onRejectChatChanges={handleRejectChatChanges}
                isChatLoading={chatLoading}
              />
            </motion.div>
          ) : workflowMode === 'inbox' ? (
            <motion.div
              key="inbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <InboxListView
                items={inboxItems}
                onItemSelect={handleInboxItemSelect}
                onNewDiagram={handleStartUploadFlow}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* CSI Floating Button */}
      <CSIFloatingButton onClick={() => setCsiWidgetOpen(true)} />

      {/* CSI Widget */}
      <CSIWidget
        isOpen={csiWidgetOpen}
        onClose={() => setCsiWidgetOpen(false)}
        onSelectCode={handleCSICodeSelect}
      />
    </div>
  );
}
