import apiClient from './client';
import type { Paginated } from '../types';

export interface LeaveType {
  id: number;
  name: string;
  label: string;
  quota_days: number;
  is_paid: boolean;
  requires_document: boolean;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: number;
  user_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string | null;
  status: LeaveStatus;
  decision_note?: string | null;
  decided_at?: string | null;
  user?: { id: number; name: string; email?: string } | null;
  leaveType?: LeaveType | null;
  decider?: { id: number; name: string } | null;
}

export async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await apiClient.get<LeaveType[]>('/leave-types');
  return data;
}

export interface LeaveFilters {
  status?: LeaveStatus;
  leave_type_id?: number;
  user_id?: number;
  mine?: boolean;
  page?: number;
  per_page?: number;
}

export async function fetchLeaveRequests(
  filters: LeaveFilters = {},
): Promise<Paginated<LeaveRequest>> {
  const { data } = await apiClient.get<Paginated<LeaveRequest>>('/leave-requests', {
    params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')),
  });
  return data;
}

export interface CreateLeavePayload {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
}

export async function createLeaveRequest(payload: CreateLeavePayload): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>('/leave-requests', payload);
  return data;
}

export async function decideLeaveRequest(
  id: number,
  payload: { status: 'approved' | 'rejected'; decision_note?: string },
): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>(`/leave-requests/${id}/decide`, payload);
  return data;
}

export async function cancelLeaveRequest(id: number): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>(`/leave-requests/${id}/cancel`);
  return data;
}

export async function deleteLeaveRequest(id: number): Promise<void> {
  await apiClient.delete(`/leave-requests/${id}`);
}
