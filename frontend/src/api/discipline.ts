import apiClient from './client';
import type { Paginated } from '../types';

export const DISCIPLINE_CATEGORIES = [
  'conduct',
  'punctuality',
  'uniform',
  'homework',
  'participation',
  'respect',
  'attendance',
  'property',
  'bullying',
  'other',
] as const;

export type DisciplineCategory = (typeof DISCIPLINE_CATEGORIES)[number];
export type DisciplineType = 'merit' | 'demerit' | 'incident' | 'note';
export type DisciplineStatus = 'open' | 'resolved' | 'appealed';

export interface DisciplineRecord {
  id: number;
  student_id: number;
  term_id?: number | null;
  recorded_by?: number | null;
  type: DisciplineType;
  category: DisciplineCategory | string;
  severity?: number | null;
  points: number;
  title: string;
  description?: string | null;
  occurred_on: string;
  status: DisciplineStatus;
  resolution?: string | null;
  resolved_at?: string | null;
  resolved_by?: number | null;
  created_at?: string;
  student?: { id: number; first_name: string; last_name: string; admission_no?: string | null } | null;
  recorder?: { id: number; name: string } | null;
  resolver?: { id: number; name: string } | null;
}

export interface DisciplineSummaryRow {
  student_id: number;
  student_name: string;
  admission_no?: string | null;
  merit_points: number;
  demerit_points: number;
  balance: number;
  merits: number;
  demerits: number;
  incidents: number;
  open: number;
}

export interface DisciplineFilters {
  student_id?: number;
  type?: DisciplineType;
  status?: DisciplineStatus;
  category?: string;
  term_id?: number;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export async function fetchDisciplineRecords(
  filters: DisciplineFilters = {},
): Promise<Paginated<DisciplineRecord>> {
  const { data } = await apiClient.get<Paginated<DisciplineRecord>>('/discipline', {
    params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')),
  });
  return data;
}

export async function fetchDisciplineSummary(params: {
  grade_id?: number;
  term_id?: number;
  student_id?: number;
}): Promise<DisciplineSummaryRow[]> {
  const { data } = await apiClient.get<DisciplineSummaryRow[]>('/discipline/summary', { params });
  return data;
}

export interface CreateDisciplinePayload {
  student_id: number;
  type: DisciplineType;
  title: string;
  category?: DisciplineCategory;
  severity?: number;
  term_id?: number;
  description?: string;
  occurred_on?: string;
}

export async function createDisciplineRecord(
  payload: CreateDisciplinePayload,
): Promise<DisciplineRecord> {
  const { data } = await apiClient.post<DisciplineRecord>('/discipline', payload);
  return data;
}

export async function updateDisciplineRecord(
  id: number,
  payload: Partial<CreateDisciplinePayload> & { status?: DisciplineStatus },
): Promise<DisciplineRecord> {
  const { data } = await apiClient.patch<DisciplineRecord>(`/discipline/${id}`, payload);
  return data;
}

export async function resolveDisciplineRecord(
  id: number,
  payload: { status: 'resolved' | 'appealed'; resolution?: string },
): Promise<DisciplineRecord> {
  const { data } = await apiClient.post<DisciplineRecord>(`/discipline/${id}/resolve`, payload);
  return data;
}

export async function deleteDisciplineRecord(id: number): Promise<void> {
  await apiClient.delete(`/discipline/${id}`);
}
