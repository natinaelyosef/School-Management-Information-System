import apiClient from './client';
import type { Application, ApplicationStatus, Paginated } from '../types';

export interface ApplicationsQuery {
  page?: number;
  status?: string;
  per_page?: number;
}

export const fetchApplications = async (
  params: ApplicationsQuery = {},
): Promise<Paginated<Application>> => {
  const { data } = await apiClient.get<Paginated<Application>>('/applications', {
    params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)),
  });
  return data;
};

export const fetchApplication = async (id: number): Promise<Application> => {
  const { data } = await apiClient.get<Application>(`/applications/${id}`);
  return data;
};

export interface ApplicationPayload {
  first_name: string;
  last_name: string;
  gender?: string | null;
  dob?: string | null;
  applying_grade_id?: number | null;
  applying_level_id?: number | null;
  academic_year_id?: number | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  address?: string | null;
}

export const createApplication = async (payload: ApplicationPayload): Promise<Application> => {
  const { data } = await apiClient.post<Application>('/applications', payload);
  return data;
};

/** Registrar review: moves an application along the pipeline. */
export const decideApplication = async (
  id: number,
  status: ApplicationStatus,
  notes?: string,
): Promise<Application> => {
  const { data } = await apiClient.post<Application>(`/applications/${id}/decide`, {
    status,
    notes: notes || undefined,
  });
  return data;
};

/** Marks an application as under review (or edits its details). */
export const updateApplication = async (
  id: number,
  payload: Partial<Application> & { status?: ApplicationStatus },
): Promise<Application> => {
  const { data } = await apiClient.patch<Application>(`/applications/${id}`, payload);
  return data;
};

export const deleteApplication = async (id: number): Promise<void> => {
  await apiClient.delete(`/applications/${id}`);
};

export interface OfferFee {
  id: number;
  name: string;
  amount: number;
  frequency?: string | null;
  due_date?: string | null;
}

export interface PaymentDetails {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  reference_hint?: string | null;
  instructions?: string | null;
  school_name?: string | null;
  school_phone?: string | null;
  school_address?: string | null;
}

/** Everything the registration office needs to make the acceptance phone call. */
export interface ApplicationOffer {
  application: Application;
  fee: OfferFee | null;
  payment: PaymentDetails;
  documents: string[];
  message: string;
  parent: { name?: string | null; phone?: string | null; email?: string | null };
}

export interface ContactPayload {
  method: 'phone' | 'telegram' | 'visit' | 'sms' | 'email';
  note: string;
}

export interface NotifyResult {
  application: Application;
  recipient: { id: number; name: string; email?: string | null; phone?: string | null } | null;
  parent_account: { id: number; email: string; password: string | null } | null;
  channels: Record<string, string>;
  delivered: boolean;
  fee: OfferFee | null;
  payment: PaymentDetails;
  message: string;
}

export interface EnrollPayload {
  grade_id: number;
  section_id?: number | null;
  parent_password?: string | null;
  notify?: boolean;
}

export interface EnrollResult {
  application: Application;
  student: { id: number; admission_no: string; first_name: string; last_name: string };
  parent: { id: number; first_name?: string; last_name?: string } | null;
  enrollment: { id: number; grade_id?: number | null; section_id?: number | null };
  invoice: { id: number; invoice_no: string; total: number | string; balance: number | string } | null;
  parent_account: { id: number; email: string; password: string | null } | null;
}

export const fetchApplicationOffer = async (id: number): Promise<ApplicationOffer> => {
  const { data } = await apiClient.get<ApplicationOffer>(`/applications/${id}/offer`);
  return data;
};

/** Logs a phone call / visit / telegram chat with the parent. */
export const contactApplication = async (
  id: number,
  payload: ContactPayload,
): Promise<Application> => {
  const { data } = await apiClient.post<Application>(`/applications/${id}/contact`, payload);
  return data;
};

/** Sends the acceptance message (in-app + Telegram) and creates the parent portal account. */
export const notifyApplication = async (id: number): Promise<NotifyResult> => {
  const { data } = await apiClient.post<NotifyResult>(`/applications/${id}/notify`);
  return data;
};

/** Creates the student, enrollment, parent link and first invoice. */
export const enrollApplication = async (
  id: number,
  payload: EnrollPayload,
): Promise<EnrollResult> => {
  const { data } = await apiClient.post<EnrollResult>(`/applications/${id}/enroll`, payload);
  return data;
};
