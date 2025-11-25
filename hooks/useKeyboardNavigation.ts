'use client';

import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
  enabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onApprove: () => void;
  onApproveAndNext: () => void;
  onExitSingleView: () => void;
  onEnterFieldMode?: () => void;
}

/**
 * Hook for keyboard navigation in single item view
 * Handles arrow keys, vim-style navigation, and approval shortcuts
 */
export function useKeyboardNavigation({
  enabled,
  onPrevious,
  onNext,
  onApprove,
  onApproveAndNext,
  onExitSingleView,
  onEnterFieldMode,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      // Let the field handle its own keyboard events (including ESC to exit field mode)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'k':
          e.preventDefault();
          onPrevious();
          break;
        case 'ArrowRight':
        case 'j':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (onEnterFieldMode) {
            onEnterFieldMode();
          }
          break;
        case 'a':
        case 'A':
        case ' ':
          e.preventDefault();
          onApprove();
          break;
        case 'Enter':
          e.preventDefault();
          onApproveAndNext();
          break;
        case 'Escape':
          e.preventDefault();
          onExitSingleView();
          break;
      }
    },
    [onPrevious, onNext, onApprove, onApproveAndNext, onExitSingleView, onEnterFieldMode]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
