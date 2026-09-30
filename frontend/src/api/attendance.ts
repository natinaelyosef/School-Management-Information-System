import apiClient from './client';
import type { AttendanceRecord, AttendanceStatus, Paginated } from '../types';

export interface AttendanceRow {
  student_id: number;
  status: AttendanceStatus;
  remark?: string | null;
}

export interface MarkAttendancePayload {
  grade_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
  academic_year_id?: number | null;
  term_id?: number | null;
  date: string;
  session?: string;
  records: AttendanceRow[];
}

export interface Attendance {
  id: number;
  grade_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
  date: string;
  session?: string | null;
  notes?: string | null;
  taken_by?: number | null;
  records_count?: number;
  records?: AttendanceRecord[];
}

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

export async function fetchAttendance(
  params: { date?: string; grade_id?: number; section_id?: number; page?: number } = {},
): Promise<Attendance[]> {
  const { data } = await apiClient.get<Attendance[] | Paginated<Attendance>>('/attendances', {
    params,
  });
  return toList(data);
}

export async function fetchAttendanceSheet(id: number): Promise<Attendance> {
  const { data } = await apiClient.get<Attendance>(`/attendances/${id}`);
  return data;
}

export async function markAttendance(payload: MarkAttendancePayload): Promise<Attendance> {
  const { data } = await apiClient.post<Attendance>('/attendances', payload);
  return data;
}

export async function updateAttendance(
  id: number,
  payload: Partial<MarkAttendancePayload>,
): Promise<Attendance> {
  const { data } = await apiClient.put<Attendance>(`/attendances/${id}`, payload);
  return data;
}
