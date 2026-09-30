import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicSite, type PublicSite } from '../api/public';

interface SchoolContextValue {
  /** The name saved under School Settings, falling back to the shipped default. */
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  motto: string | null;
  established: string | null;
  stats: PublicSite['stats'];
  /** False while the details are still loading or the request failed. */
  loaded: boolean;
}

export const SCHOOL_NAME_FALLBACK = 'Bright Future Academy';

const SchoolContext = createContext<SchoolContextValue>({
  name: SCHOOL_NAME_FALLBACK,
  phone: null,
  email: null,
  address: null,
  motto: null,
  established: null,
  stats: { students: '2,500+', teachers: '120+', levels: '3', years: '15+' },
  loaded: false,
});

/**
 * The school's own name, phone, address and headline figures.
 *
 * Every public surface reads from here so that renaming the school in Settings
 * updates the navbar, footer and home page, rather than showing a name that was
 * typed into the markup. Settings saves invalidate the 'public-site' key.
 */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { data, isSuccess } = useQuery({
    queryKey: ['public-site'],
    queryFn: fetchPublicSite,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const value = useMemo<SchoolContextValue>(
    () => ({
      name: data?.name?.trim() || SCHOOL_NAME_FALLBACK,
      phone: data?.phone ?? null,
      email: data?.email ?? null,
      address: data?.address ?? null,
      motto: data?.motto ?? null,
      established: data?.established ?? null,
      stats: data?.stats ?? { students: '2,500+', teachers: '120+', levels: '3', years: '15+' },
      loaded: isSuccess,
    }),
    [data, isSuccess],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolContextValue {
  return useContext(SchoolContext);
}
