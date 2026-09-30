import apiClient from './client';
import type { AuthResponse, Role, User } from '../types';

/** Backend role names that differ from the frontend Role union. */
const ROLE_ALIASES: Record<string, Role> = {
  academic_coordinator: 'academic',
  registration_office: 'registration',
};

export function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null;
  return ROLE_ALIASES[role] ?? (role as Role);
}

function withRole<T extends User>(user: T): T {
  const raw = user.permissions as unknown;
  const permissions = Array.isArray(raw)
    ? raw
        .map((p) => (typeof p === 'string' ? p : (p as { name?: string })?.name))
        .filter((p): p is string => Boolean(p))
    : undefined;
  return { ...user, role: normalizeRole(user.role) ?? user.role, permissions };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return { ...data, user: withRole(data.user) };
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function me(): Promise<User> {
  const { data } = await apiClient.get<User>('/me');
  return withRole(data);
}

/** The parent portal's child switcher — every child linked to this account. */
export interface ChildSummary {
  id: number;
  admission_no?: string | null;
  first_name: string;
  last_name: string;
  gender?: string | null;
  dob?: string | null;
  status?: string | null;
  photo?: string | null;
  full_name?: string;
  grade?: { id: number; name: string } | null;
  section?: { id: number; name: string } | null;
  academic_year?: { id: number; name: string } | null;
}

export async function fetchChildren(): Promise<ChildSummary[]> {
  const { data } = await apiClient.get<ChildSummary[]>('/me/children');
  return data;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/register', payload);
  return { ...data, user: withRole(data.user) };
}
