'use client';

/**
 * EditModeContext
 * Shares edit mode state between layout and page components
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface EditModeContextType {
  isEditMode: boolean;
  canEdit: boolean;
  isSaving: boolean;
  setEditMode: (value: boolean) => void;
  setCanEdit: (value: boolean) => void;
  triggerSave: () => Promise<void>;
  triggerDelete: () => void;
  registerCallbacks: (callbacks: { onSave?: () => Promise<void>; onDelete?: () => void }) => void;
  unregisterCallbacks: () => void;
}

const EditModeContext = createContext<EditModeContextType | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Use refs to store callbacks so they can be updated without re-renders
  const onSaveRef = useRef<(() => Promise<void>) | null>(null);
  const onDeleteRef = useRef<(() => void) | null>(null);

  const setEditMode = useCallback((value: boolean) => {
    setIsEditMode(value);
  }, []);

  const registerCallbacks = useCallback((callbacks: { onSave?: () => Promise<void>; onDelete?: () => void }) => {
    if (callbacks.onSave) {
      onSaveRef.current = callbacks.onSave;
    }
    if (callbacks.onDelete) {
      onDeleteRef.current = callbacks.onDelete;
    }
    setCanEdit(true);
  }, []);

  const unregisterCallbacks = useCallback(() => {
    onSaveRef.current = null;
    onDeleteRef.current = null;
    setCanEdit(false);
    setIsEditMode(false);
  }, []);

  const triggerSave = useCallback(async () => {
    if (onSaveRef.current) {
      setIsSaving(true);
      try {
        await onSaveRef.current();
      } finally {
        setIsSaving(false);
      }
    }
  }, []);

  const triggerDelete = useCallback(() => {
    if (onDeleteRef.current) {
      onDeleteRef.current();
    }
  }, []);

  return (
    <EditModeContext.Provider
      value={{
        isEditMode,
        canEdit,
        isSaving,
        setEditMode,
        setCanEdit,
        triggerSave,
        triggerDelete,
        registerCallbacks,
        unregisterCallbacks,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
}
