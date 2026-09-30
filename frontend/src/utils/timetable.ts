import type { TimetableSlot } from '../types';

/** Timetable API payload — the controller returns loaded relations, not labels. */
export interface SlotPayload extends Omit<TimetableSlot, 'subject' | 'teacher'> {
  start_time?: string | null;
  end_time?: string | null;
  grade?: { id: number; name: string } | string | null;
  section?: { id: number; name: string } | string | null;
  subject?: string | { id: number; name: string } | null;
  teacher?: string | { id: number; name: string } | null;
}

function label(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const record = value as { name?: string; code?: string };
  return record.name ?? record.code ?? '';
}

/** JS getDay() is 0 = Sunday; the backend numbers days 1 = Monday … 6 = Saturday. */
export function todayDayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export function slotSubject(slot: SlotPayload): string {
  return label(slot.subject) || '—';
}

export function slotClass(slot: SlotPayload): string {
  const grade = label(slot.grade);
  const section = label(slot.section);
  if (!grade && !section) return '';
  return `${grade}${section ? `-${section}` : ''}`;
}

export function slotTime(slot: SlotPayload): string | null {
  if (!slot.start_time) return null;
  const start = slot.start_time.slice(0, 5);
  const end = slot.end_time ? slot.end_time.slice(0, 5) : null;
  return end ? `${start}–${end}` : start;
}

export function sortSlots(slots: SlotPayload[]): SlotPayload[] {
  return [...slots].sort((a, b) => Number(a.period) - Number(b.period));
}
