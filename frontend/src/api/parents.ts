import apiClient from './client';
import type { Paginated } from '../types';

export interface ParentStudent {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  grade_id?: number | null;
}

export interface SchoolParent {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  relationship?: string | null;
  user_id?: number | null;
  students?: ParentStudent[];
  created_at?: string;
  updated_at?: string;
}

export interface ParentPayload {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  relationship?: string | null;
  user_id?: number | null;
  student_ids?: number[];
}

export async function fetchParents(
  page = 1,
  params: Record<string, unknown> = {},
): Promise<Paginated<SchoolParent>> {
  const { data } = await apiClient.get<Paginated<SchoolParent>>('/parents', {
    params: { page, per_page: 20, ...params },
  });
  return data;
}

export async function fetchParent(id: number): Promise<SchoolParent> {
  const { data } = await apiClient.get<SchoolParent>(`/parents/${id}`);
  return data;
}

export async function createParent(payload: ParentPayload): Promise<SchoolParent> {
  const { data } = await apiClient.post<SchoolParent>('/parents', payload);
  return data;
}

export async function updateParent(id: number, payload: ParentPayload): Promise<SchoolParent> {
  const { data } = await apiClient.patch<SchoolParent>(`/parents/${id}`, payload);
  return data;
}

export async function deleteParent(id: number): Promise<void> {
  await apiClient.delete(`/parents/${id}`);
}
