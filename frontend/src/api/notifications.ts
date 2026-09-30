import apiClient from './client';
import type { Paginated } from '../types';

export interface NotificationItem {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  channel: string;
  status: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationChannelState {
  enabled: boolean;
  opted_in: boolean;
}

export interface NotificationChannels {
  channels: Record<string, NotificationChannelState>;
  has_phone: boolean;
  has_telegram_chat_id: boolean;
}

export interface NotificationPreferences {
  phone?: string | null;
  telegram_chat_id?: string | null;
  notify_sms?: boolean;
  notify_telegram?: boolean;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<Paginated<NotificationItem>>('/notifications');
  return data.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function fetchNotificationChannels(): Promise<NotificationChannels> {
  const { data } = await apiClient.get<NotificationChannels>('/notifications/channels');
  return data;
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<void> {
  await apiClient.put('/notifications/preferences', prefs);
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}
