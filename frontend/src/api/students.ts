import apiClient from './client';
import type { Paginated, Student } from '../types';

export async function fetchStudents(
  page = 1,
  params: Record<string, unknown> = {},
): Promise<Paginated<Student>> {
  const { data } = await apiClient.get<Paginated<Student>>('/students', {
    params: { page, per_page: 100, ...params },
  });
  return data;
}

export async function fetchStudent(id: number): Promise<Student> {
  const { data } = await apiClient.get<Student>(`/students/${id}`);
  return data;
}

export async function createStudent(payload: Partial<Student>): Promise<Student> {
  const { data } = await apiClient.post<Student>('/students', payload);
  return data;
}

export interface PromotePayload {
  academic_year_id: number;
  grade_id?: number | null;
  section_id?: number | null;
  level_id?: number | null;
  status?: string;
}

export async function promoteStudent(id: number, payload: PromotePayload): Promise<unknown> {
  const { data } = await apiClient.post(`/students/${id}/promote`, payload);
  return data;
}

export interface TransferPayload {
  type: 'internal' | 'transfer_in' | 'transfer_out';
  effective_date: string;
  to_grade_id?: number | null;
  to_section_id?: number | null;
  to_level_id?: number | null;
  academic_year_id?: number | null;
  reason?: string;
  destination_school?: string;
}

export async function transferStudent(id: number, payload: TransferPayload): Promise<Student> {
  const { data } = await apiClient.post<Student>(`/students/${id}/transfer`, payload);
  return data;
}

export interface StatusPayload {
  status: 'active' | 'suspended' | 'withdrawn' | 'graduated' | 'inactive';
  effective_date: string;
  reason?: string;
  academic_year_id?: number | null;
}

export async function changeStudentStatus(id: number, payload: StatusPayload): Promise<Student> {
  const { data } = await apiClient.post<Student>(`/students/${id}/status`, payload);
  return data;
}

export async function deleteStudent(id: number): Promise<void> {
  await apiClient.delete(`/students/${id}`);
}
