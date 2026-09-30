import axios from 'axios';
import apiClient, { apiClient as client } from './client';
import type { Paginated } from '../types';

/** Anonymous endpoints — deliberately created without the auth header. */
const publicClient = axios.create({
  baseURL: apiClient.defaults.baseURL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

export interface PublicSite {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  motto?: string | null;
  established?: string | null;
  logo?: string | null;
  stats: { students: string; teachers: string; levels: string; years: string };
}

export interface PublicNewsItem {
  id: number;
  title: string;
  body?: string | null;
  audience?: string | null;
  is_pinned?: boolean;
  published_at?: string | null;
}

export interface PublicEvent {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at?: string | null;
}

export interface PublicTeacher {
  id: number;
  first_name: string;
  last_name: string;
  specialization?: string | null;
  qualification?: string | null;
}

export interface ApplicationPayload {
  first_name: string;
  last_name: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string | null;
  applying_level_id?: number | null;
  applying_grade_id?: number | null;
  academic_year_id?: number | null;
  previous_school?: string | null;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  address?: string | null;
  emergency_contact?: string | null;
  note?: string | null;
}

export interface ApplicationReceipt {
  application_no: string;
  status: string;
  submitted_at?: string | null;
}

export interface TrackingResult {
  application_no: string;
  student: string;
  status: string;
  submitted_at?: string | null;
  decided_at?: string | null;
  notes?: string | null;
  documents: number;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string | null;
  type?: string;
  subject?: string | null;
  message: string;
  preferred_contact?: 'email' | 'phone';
}

export const fetchPublicSite = async (): Promise<PublicSite> => {
  const { data } = await publicClient.get<PublicSite>('/public/site');
  return data;
};

export const fetchPublicNews = async (page = 1): Promise<PublicNewsItem[]> => {
  const { data } = await publicClient.get<PublicNewsItem[] | Paginated<PublicNewsItem>>('/public/news', {
    params: { page },
  });
  return toList(data);
};

export const fetchPublicEvents = async (page = 1): Promise<PublicEvent[]> => {
  const { data } = await publicClient.get<PublicEvent[] | Paginated<PublicEvent>>('/public/events', {
    params: { page },
  });
  return toList(data);
};

export const fetchPublicTeachers = async (page = 1): Promise<PublicTeacher[]> => {
  const { data } = await publicClient.get<PublicTeacher[] | Paginated<PublicTeacher>>('/public/teachers', {
    params: { page },
  });
  return toList(data);
};

export const submitApplication = async (payload: ApplicationPayload): Promise<ApplicationReceipt> => {
  const { data } = await publicClient.post<ApplicationReceipt>('/public/applications', payload);
  return data;
};

export const trackApplication = async (input: {
  code: string;
  email: string;
}): Promise<TrackingResult> => {
  const { data } = await publicClient.post<TrackingResult>('/public/applications/track', input);
  return data;
};

export const submitContact = async (
  payload: ContactPayload,
): Promise<{ reference: string; message: string }> => {
  const { data } = await publicClient.post<{ reference: string; message: string }>(
    '/public/contact',
    payload,
  );
  return data;
};

/** Staff-facing inboxes that consume what the public forms write. */
export const fetchInquiries = async (): Promise<unknown[]> => {
  const { data } = await client.get<unknown[] | Paginated<unknown>>('/inquiries');
  return toList(data as unknown[] | Paginated<unknown>);
};
