import apiClient from './client';
import type { Paginated } from '../types';

export interface AuditEntry {
  id: number;
  user_id?: number | null;
  action: string;
  auditable_type?: string | null;
  auditable_id?: number | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  user?: { id: number; name: string; email?: string } | null;
}

export interface AuditFilters {
  page?: number;
  q?: string;
  action?: string;
  user_id?: number | '';
  from?: string;
  to?: string;
  per_page?: number;
}

export const fetchAudit = async (filters: AuditFilters = {}): Promise<Paginated<AuditEntry>> => {
  const { data } = await apiClient.get<Paginated<AuditEntry>>('/audit', {
    params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)),
  });
  return data;
};

export const fetchAuditActions = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>('/audit/actions');
  return data;
};

export interface AuditUser {
  id: number;
  name: string;
  email?: string;
}

export const fetchAuditUsers = async (): Promise<AuditUser[]> => {
  const { data } = await apiClient.get<AuditUser[]>('/audit/users');
  return data;
};

// ---- Public content: events calendar ---------------------------------------

export interface SchoolEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  audience?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: 'draft' | 'published';
  published_at?: string | null;
  created_at?: string;
}

export interface EventPayload {
  title: string;
  description?: string | null;
  location?: string | null;
  audience?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status?: 'draft' | 'published';
}

export const fetchAdminEvents = async (
  params: { page?: number; status?: string; q?: string } = {},
): Promise<Paginated<SchoolEvent>> => {
  const { data } = await apiClient.get<Paginated<SchoolEvent>>('/events', {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)),
  });
  return data;
};

export const createEvent = async (payload: EventPayload): Promise<SchoolEvent> => {
  const { data } = await apiClient.post<SchoolEvent>('/events', payload);
  return data;
};

export const updateEvent = async (id: number, payload: Partial<EventPayload>): Promise<SchoolEvent> => {
  const { data } = await apiClient.put<SchoolEvent>(`/events/${id}`, payload);
  return data;
};

export const deleteEvent = async (id: number): Promise<void> => {
  await apiClient.delete(`/events/${id}`);
};

// ---- Contact inquiries ------------------------------------------------------

export interface Inquiry {
  id: number;
  reference: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type: string;
  subject?: string | null;
  message: string;
  preferred_contact?: string | null;
  status: 'new' | 'contacted' | 'follow_up' | 'resolved' | 'closed';
  staff_notes?: string | null;
  handled_by?: number | null;
  responded_at?: string | null;
  created_at: string;
  handler?: { id: number; name: string } | null;
}

export const fetchInquiries = async (
  params: { page?: number; status?: string; per_page?: number } = {},
): Promise<Paginated<Inquiry>> => {
  const { data } = await apiClient.get<Paginated<Inquiry>>('/inquiries', {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)),
  });
  return data;
};

export const updateInquiry = async (
  id: number,
  payload: { status?: Inquiry['status']; staff_notes?: string | null },
): Promise<Inquiry> => {
  const { data } = await apiClient.patch<Inquiry>(`/inquiries/${id}`, payload);
  return data;
};

// ---- Payment follow-up tasks ------------------------------------------------

export interface PaymentTask {
  id: number;
  student_invoice_id: number;
  student_id?: number | null;
  type: string;
  priority: string;
  status: 'open' | 'completed';
  title: string;
  notes?: string | null;
  due_date?: string | null;
  outcome?: string | null;
  outcome_notes?: string | null;
  assigned_to?: number | null;
  completed_at?: string | null;
  created_at: string;
  invoice?: {
    id: number;
    invoice_no?: string;
    balance?: number | string;
    student?: { id: number; first_name: string; last_name: string } | null;
  } | null;
  student?: { id: number; first_name: string; last_name: string } | null;
  assignee?: { id: number; name: string } | null;
  completer?: { id: number; name: string } | null;
}

export const fetchPaymentTasks = async (
  params: { page?: number; status?: string; type?: string } = {},
): Promise<Paginated<PaymentTask>> => {
  const { data } = await apiClient.get<Paginated<PaymentTask>>('/payment-tasks', {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)),
  });
  return data;
};

export const completePaymentTask = async (
  id: number,
  payload: { outcome: string; notes?: string | null },
): Promise<PaymentTask> => {
  const { data } = await apiClient.post<PaymentTask>(`/payment-tasks/${id}/complete`, payload);
  return data;
};

export const reopenPaymentTask = async (id: number): Promise<PaymentTask> => {
  const { data } = await apiClient.post<PaymentTask>(`/payment-tasks/${id}/reopen`);
  return data;
};
