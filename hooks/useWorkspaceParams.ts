'use client';

/**
 * useWorkspaceParams Hook
 * Manages workspace query parameters for chat, view mode, item selection, and diagram
 */

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface WorkspaceParams {
  chat: boolean;
  view: 'single' | 'grid';
  item: number;
  diagram: string | null;
}

export function useWorkspaceParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: WorkspaceParams = useMemo(() => ({
    chat: searchParams.get('chat') === 'true',
    view: (searchParams.get('view') as 'single' | 'grid') || 'single',
    item: parseInt(searchParams.get('item') || '0', 10),
    diagram: searchParams.get('diagram'),
  }), [searchParams]);

  const setParams = useCallback((updates: Partial<WorkspaceParams>) => {
    const newParams = new URLSearchParams(searchParams.toString());

    // Handle each param type specifically
    if ('chat' in updates) {
      if (updates.chat) {
        newParams.set('chat', 'true');
      } else {
        newParams.delete('chat');
      }
    }

    if ('view' in updates) {
      if (updates.view && updates.view !== 'single') {
        newParams.set('view', updates.view);
      } else {
        newParams.delete('view');
      }
    }

    if ('item' in updates) {
      if (updates.item && updates.item > 0) {
        newParams.set('item', String(updates.item));
      } else {
        newParams.delete('item');
      }
    }

    if ('diagram' in updates) {
      if (updates.diagram) {
        newParams.set('diagram', updates.diagram);
      } else {
        newParams.delete('diagram');
      }
    }

    const queryString = newParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  const setChatOpen = useCallback((open: boolean) => {
    setParams({ chat: open });
  }, [setParams]);

  const setViewMode = useCallback((mode: 'single' | 'grid') => {
    setParams({ view: mode });
  }, [setParams]);

  const setCurrentItem = useCallback((index: number) => {
    setParams({ item: index });
  }, [setParams]);

  const setDiagram = useCallback((diagramId: string | null) => {
    setParams({ diagram: diagramId });
  }, [setParams]);

  return {
    params,
    setParams,
    setChatOpen,
    setViewMode,
    setCurrentItem,
    setDiagram,
  };
}

export default useWorkspaceParams;
