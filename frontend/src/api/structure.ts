import apiClient from './client';
import type { Paginated } from '../types';

export interface SchoolLevel {
  id: number;
  name: string;
  code?: string | null;
  order_index?: number | null;
}

export interface Grade {
  id: number;
  name: string;
  code?: string | null;
  school_level_id?: number | null;
  order_index?: number | null;
  is_active?: boolean;
}

export interface Section {
  id: number;
  name: string;
  grade_id?: number | null;
  capacity?: number | null;
  is_active?: boolean;
}

export interface AcademicYear {
  id: number;
  name: string;
  code?: string | null;
  is_current?: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export interface Term {
  id: number;
  name: string;
  academic_year_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  status?: string | null;
}

type Resource = 'levels' | 'grades' | 'sections' | 'years' | 'terms';

async function list<T>(resource: Resource, params: Record<string, unknown> = {}): Promise<T[]> {
  const { data } = await apiClient.get<T[] | Paginated<T>>(`/structure/${resource}`, {
    params: { per_page: 200, ...params },
  });
  return Array.isArray(data) ? data : data.data;
}

export const fetchLevels = (): Promise<SchoolLevel[]> => list<SchoolLevel>('levels');
export const fetchGrades = (params?: Record<string, unknown>): Promise<Grade[]> =>
  list<Grade>('grades', params);
export const fetchSections = (params?: Record<string, unknown>): Promise<Section[]> =>
  list<Section>('sections', params);
export const fetchYears = (): Promise<AcademicYear[]> => list<AcademicYear>('years');
export const fetchTerms = (params?: Record<string, unknown>): Promise<Term[]> =>
  list<Term>('terms', params);

/** The academic year everything defaults to (create-exam, promotions, reports). */
export async function fetchCurrentYear(): Promise<AcademicYear | null> {
  const years = await fetchYears();
  return years.find((y) => y.is_current) ?? years[0] ?? null;
}

/** The term flagged as current, if the school has set one up. */
export async function fetchCurrentTerm(): Promise<Term | null> {
  const terms = await fetchTerms();
  return terms.find((t) => t.is_current) ?? null;
}
