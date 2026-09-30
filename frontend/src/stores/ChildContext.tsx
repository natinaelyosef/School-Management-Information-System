import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchChildren, type ChildSummary } from '../api/auth';
import { useAuth } from './AuthContext';

interface ChildContextValue {
  children: ChildSummary[];
  isLoading: boolean;
  selectedId: number | null;
  selected: ChildSummary | null;
  select: (id: number | null) => void;
}

const STORAGE_KEY = 'smis_active_child';

const ChildContext = createContext<ChildContextValue | null>(null);

function readStoredId(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) ? parsed : null;
}

export function ChildProvider({ children: node }: { children: ReactNode }) {
  const { role, isAuthenticated } = useAuth();
  const [storedId, setStoredId] = useState<number | null>(readStoredId);

  const enabled = isAuthenticated && role === 'parent';
  const query = useQuery({
    queryKey: ['me', 'children'],
    queryFn: fetchChildren,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  const list = useMemo(() => query.data ?? [], [query.data]);

  // Fall back to the first linked child when nothing is stored or the stored
  // child is no longer on the account — derived during render, no effect needed.
  const selectedId = useMemo(() => {
    if (list.length === 0) return null;
    if (storedId !== null && list.some((child) => child.id === storedId)) return storedId;
    return list[0].id;
  }, [list, storedId]);

  const select = useCallback((id: number | null) => {
    setStoredId(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  const value = useMemo<ChildContextValue>(
    () => ({
      children: list,
      isLoading: query.isLoading,
      selectedId,
      selected: list.find((child) => child.id === selectedId) ?? null,
      select,
    }),
    [list, query.isLoading, selectedId, select],
  );

  return <ChildContext.Provider value={value}>{node}</ChildContext.Provider>;
}

export function useChildren(): ChildContextValue {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error('useChildren must be used inside <ChildProvider>');
  return ctx;
}

/** Non-throwing variant for components that may render outside the provider. */
export function useOptionalChildren(): ChildContextValue | null {
  return useContext(ChildContext);
}
