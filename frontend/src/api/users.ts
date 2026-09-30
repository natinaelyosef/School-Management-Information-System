import apiClient from './client';
import type { Paginated } from '../types';

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  role?: string | null;
  roles?: Array<{ id: number; name: string }>;
  created_at?: string | null;
}

export interface RoleSummary {
  id: number;
  name: string;
  permissions_count?: number;
  users_count?: number;
  built_in?: boolean;
}

export interface DepartmentDetail {
  id: number;
  name: string;
  built_in: boolean;
  users_count: number;
  permissions: string[];
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roles: string[];
}

export type BulkUserPayload = CreateUserPayload;

export interface UserListParams {
  role?: string;
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export async function fetchUsers(params?: UserListParams): Promise<Paginated<ManagedUser>> {
  const { data } = await apiClient.get<Paginated<ManagedUser>>('/users', { params });
  return data;
}

export async function fetchRoles(): Promise<RoleSummary[]> {
  const { data } = await apiClient.get<RoleSummary[]>('/roles');
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<ManagedUser> {
  const { data } = await apiClient.post<ManagedUser>('/users', payload);
  return data;
}

export async function bulkCreateUsers(users: BulkUserPayload[]): Promise<ManagedUser[]> {
  const { data } = await apiClient.post<ManagedUser[]>('/users/bulk', { users });
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<CreateUserPayload> & { is_active?: boolean },
): Promise<ManagedUser> {
  const { data } = await apiClient.patch<ManagedUser>(`/users/${id}`, payload);
  return data;
}

export async function suspendUser(id: number): Promise<unknown> {
  const { data } = await apiClient.post(`/users/${id}/suspend`);
  return data;
}

export async function activateUser(id: number): Promise<unknown> {
  const { data } = await apiClient.post(`/users/${id}/activate`);
  return data;
}

export async function resetUserPassword(id: number, password: string): Promise<unknown> {
  const { data } = await apiClient.post(`/users/${id}/reset-password`, { password });
  return data;
}

export async function deleteUser(id: number): Promise<unknown> {
  const { data } = await apiClient.delete(`/users/${id}`);
  return data;
}

/** Every permission name in the system — the picker for department (role) editing. */
export async function fetchPermissions(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/permissions');
  return data;
}

/** Departments = roles. List with permission + account counts. */
export async function fetchDepartments(): Promise<RoleSummary[]> {
  const { data } = await apiClient.get<RoleSummary[]>('/departments');
  return data;
}

export async function fetchDepartment(id: number): Promise<DepartmentDetail> {
  const { data } = await apiClient.get<DepartmentDetail>(`/departments/${id}`);
  return data;
}

export async function createDepartment(payload: {
  name: string;
  permissions: string[];
}): Promise<DepartmentDetail> {
  const { data } = await apiClient.post<DepartmentDetail>('/departments', payload);
  return data;
}

export async function updateDepartment(
  id: number,
  payload: { name?: string; permissions: string[] },
): Promise<DepartmentDetail> {
  const { data } = await apiClient.patch<DepartmentDetail>(`/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: number): Promise<unknown> {
  const { data } = await apiClient.delete(`/departments/${id}`);
  return data;
}
