import apiClient from './client';
import type { Paginated } from '../types';

export type CampaignAudience = 'all_parents' | 'grade' | 'section' | 'staff';

export interface CampaignOption {
  value: CampaignAudience;
  label: string;
  count: number;
  grade_id?: number;
  section_id?: number;
  role?: string;
}

export interface CampaignChannels {
  [channel: string]: boolean;
}

export interface CampaignTargets {
  options: CampaignOption[];
  channels: CampaignChannels;
}

export interface NotificationCampaign {
  id: number;
  title: string;
  body: string;
  audience: CampaignAudience;
  label?: string | null;
  grade_id?: number | null;
  section_id?: number | null;
  role?: string | null;
  channels?: string[] | null;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  sent_at?: string | null;
  sender?: { id: number; name: string } | null;
  grade?: { id: number; name: string } | null;
  section?: { id: number; name: string } | null;
}

export async function fetchCampaignTargets(): Promise<CampaignTargets> {
  const { data } = await apiClient.get<CampaignTargets>('/campaigns/audiences');
  return data;
}

export async function fetchCampaigns(): Promise<Paginated<NotificationCampaign>> {
  const { data } = await apiClient.get<Paginated<NotificationCampaign>>('/campaigns');
  return data;
}

export interface CreateCampaignPayload {
  title: string;
  body: string;
  audience: CampaignAudience;
  grade_id?: number;
  section_id?: number;
  role?: string;
  channels?: string[];
}

export async function createCampaign(
  payload: CreateCampaignPayload,
): Promise<NotificationCampaign> {
  const { data } = await apiClient.post<NotificationCampaign>('/campaigns', payload);
  return data;
}

export async function deleteCampaign(id: number): Promise<void> {
  await apiClient.delete(`/campaigns/${id}`);
}
