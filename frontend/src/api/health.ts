import apiClient from './client';
import type { HealthRecord, HealthVisit, Paginated } from '../types';

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

export async function fetchHealthVisits(): Promise<HealthVisit[]> {
  const { data } = await apiClient.get<HealthVisit[] | Paginated<HealthVisit>>('/health/visits');
  return toList(data);
}

export async function createHealthVisit(payload: Partial<HealthVisit>): Promise<HealthVisit> {
  const { data } = await apiClient.post<HealthVisit>('/health/visits', payload);
  return data;
}

export async function fetchHealthRecords(): Promise<HealthRecord[]> {
  const { data } = await apiClient.get<HealthRecord[] | Paginated<HealthRecord>>('/health/records');
  return toList(data);
}

export async function createHealthRecord(payload: Partial<HealthRecord>): Promise<HealthRecord> {
  const { data } = await apiClient.post<HealthRecord>('/health/records', payload);
  return data;
}
