import apiClient from './client';
import type { Message, Paginated } from '../types';

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

export async function fetchInbox(): Promise<Message[]> {
  const { data } = await apiClient.get<Message[] | Paginated<Message>>('/messages/inbox');
  return toList(data);
}

export async function fetchSent(): Promise<Message[]> {
  const { data } = await apiClient.get<Message[] | Paginated<Message>>('/messages/sent');
  return toList(data);
}

export interface ComposePayload {
  subject?: string;
  body: string;
  recipient_id?: number;
  /** Every active member of a department, not just one person. */
  recipient_role?: string;
  /** A picked group of people. */
  recipient_ids?: number[];
  context?: 'fees' | 'grades' | 'attendance' | 'general';
}

export interface SentMessage extends Message {
  recipients?: number;
  broadcast?: boolean;
}

/** A department and how many active people belong to it. */
export interface MessageDepartment {
  id: number;
  name: string;
  members: number;
}

export async function fetchMessageDepartments(): Promise<MessageDepartment[]> {
  const { data } = await apiClient.get<MessageDepartment[]>('/messages/departments');
  return data;
}

/** People this account may message directly: my child's teachers, my students' parents. */
export interface MessageContacts {
  teachers: Array<{ id: number; name: string; role?: string }>;
  parents: Array<{ id: number; name: string; children?: string[] }>;
}

export async function fetchMessageContacts(): Promise<MessageContacts> {
  const { data } = await apiClient.get<MessageContacts>('/messages/contacts');
  return data;
}

export async function sendMessage(payload: ComposePayload): Promise<SentMessage> {
  const { data } = await apiClient.post<SentMessage>('/messages', payload);
  return data;
}

export async function markMessageRead(id: number): Promise<void> {
  await apiClient.post(`/messages/${id}/read`);
}

export async function toggleStar(id: number): Promise<void> {
  await apiClient.post(`/messages/${id}/star`);
}

// ---- Threads & attachments --------------------------------------------------

export interface MessageAttachment {
  id: number;
  original_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  file_path?: string;
}

export interface ThreadMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: { id: number; name: string } | null;
  sender_name?: string | null;
  body?: string | null;
  context?: string | null;
  is_starred?: boolean;
  created_at: string;
  attachments?: MessageAttachment[];
}

export interface Conversation {
  id: number;
  subject?: string | null;
  type?: string | null;
  last_message_at?: string | null;
  participants?: Array<{ id: number; name: string; email?: string }>;
  messages?: ThreadMessage[];
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<Conversation[] | Paginated<Conversation>>('/conversations');
  return toList(data);
}

export async function fetchConversationMessages(conversationId: number): Promise<ThreadMessage[]> {
  const { data } = await apiClient.get<ThreadMessage[] | Paginated<ThreadMessage>>(
    `/conversations/${conversationId}/messages`,
  );
  return toList(data);
}

/** Sends a thread reply, optionally with one file attached (multipart). */
export async function sendConversationMessage(
  conversationId: number,
  payload: { body: string; file?: File | null },
): Promise<ThreadMessage> {
  const fd = new FormData();
  fd.append('body', payload.body);
  if (payload.file) fd.append('file', payload.file);

  const { data } = await apiClient.post<ThreadMessage>(
    `/conversations/${conversationId}/messages`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/** Streams an attachment through the API (auth header required) and saves it. */
export async function downloadAttachment(attachment: MessageAttachment): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(
    `/messages/attachments/${attachment.id}/file`,
    { responseType: 'blob' },
  );

  const disposition = String(headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? attachment.original_name ?? 'attachment';

  const url = URL.createObjectURL(new Blob([data]));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
