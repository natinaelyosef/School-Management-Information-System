import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import {
  createTimetableSlot,
  deleteTimetableSlot,
  fetchSubjects,
  fetchTimetable,
} from '../../api/academics';
import { fetchTeachers } from '../../api/teachers';
import { apiErrorMessage } from '../../utils/errors';
import type { TimetableSlot } from '../../types';
import { useTranslation } from 'react-i18next';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const SECTIONS = ['A', 'B', 'C'];

type Toast = { kind: 'red' | 'green'; text: string } | null;

export default function TimetablePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [gradeId, setGradeId] = useState('8');
  const [sectionId, setSectionId] = useState('1');

  const timetableQuery = useQuery({
    queryKey: ['timetable', gradeId, sectionId],
    queryFn: () => fetchTimetable({ grade_id: Number(gradeId), section_id: Number(sectionId) }),
    retry: false,
  });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects, retry: false });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: () => fetchTeachers(1), retry: false });

  const slots = timetableQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const teachers = teachersQuery.data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ day: 'Monday', period: '1', subject_id: '1', teacher_id: '1', room: '' });
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (kind: 'red' | 'green', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['timetable'] });

  const cellKey = (day: string, period: number | string) => `${day}-${period}`;
  const grid = new Map<string, TimetableSlot>();
  for (const slot of slots) grid.set(cellKey(slot.day, slot.period), slot);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const subject = subjects.find((s) => String(s.id) === form.subject_id);
      const teacher = teachers.find((t) => String(t.id) === form.teacher_id);
      await createTimetableSlot({
        day: form.day,
        period: Number(form.period),
        subject_id: Number(form.subject_id),
        teacher_id: Number(form.teacher_id),
        subject: subject?.name,
        teacher: teacher ? `${teacher.first_name} ${teacher.last_name}` : undefined,
        room: form.room || undefined,
        grade_id: Number(gradeId),
        section_id: Number(sectionId),
      });
      await refresh();
      setOpen(false);
      showToast('green', 'Slot added to the timetable.');
    } catch (err) {
      const msg = apiErrorMessage(err, 'The slot could not be saved.');
      showToast('red', msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot: TimetableSlot) => {
    if (!window.confirm(`Delete ${slot.subject ?? 'this slot'} on ${slot.day} period ${slot.period}?`)) return;
    try {
      await deleteTimetableSlot(slot.id);
      await refresh();
      showToast('green', 'Slot deleted.');
    } catch (err) {
      showToast('red', apiErrorMessage(err, 'The slot could not be deleted.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.timetable.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.timetable.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </Select>
          <Select label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {SECTIONS.map((s, i) => (
              <option key={s} value={i + 1}>Section {s}</option>
            ))}
          </Select>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Add slot
          </Button>
        </div>
      </div>

      {timetableQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(timetableQuery.error, 'The timetable could not be loaded.')}
        </p>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-20 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.kind === 'red' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.text}
        </div>
      )}

      <Card title={`Grade ${gradeId} — Section ${SECTIONS[Number(sectionId) - 1] ?? 'A'}`} subtitle="Click ✕ on a slot to delete it">
        {timetableQuery.isPending && (
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {!timetableQuery.isPending && !timetableQuery.isError && slots.length === 0 && (
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">No timetable slots yet.</p>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-24 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-left font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Day
                </th>
                {PERIODS.map((p) => (
                  <th
                    key={p}
                    className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-center font-semibold uppercase text-slate-500 dark:text-slate-400"
                  >
                    P{p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <th className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">
                    {day}
                  </th>
                  {PERIODS.map((period) => {
                    const slot = grid.get(cellKey(day, period));
                    return (
                      <td key={period} className="h-16 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 align-top">
                        {slot ? (
                          <div className="group relative h-full rounded-lg bg-blue-50 dark:bg-blue-950/40 p-1.5 text-blue-900 dark:text-blue-200">
                            <button
                              onClick={() => remove(slot)}
                              className="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:bg-red-900/50 group-hover:block"
                              aria-label="Delete slot"
                            >
                              <X size={12} />
                            </button>
                            <p className="truncate pr-3 font-bold">{slot.subject ?? '—'}</p>
                            <p className="truncate text-slate-600 dark:text-slate-300">{slot.teacher ?? ''}</p>
                            <p className="truncate text-slate-400 dark:text-slate-500">{slot.room ?? ''}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setForm({ ...form, day, period: String(period) });
                              setOpen(true);
                            }}
                            className="h-full w-full rounded-lg text-slate-300 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-blue-600 dark:hover:text-blue-400 hover:text-blue-400"
                            aria-label={`Add slot ${day} period ${period}`}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} title="Add Timetable Slot" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Day" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Select label="Period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>Period {p}</option>
              ))}
            </Select>
          </div>
          <Select label={t('campaigns.subject')} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
            {subjects.length === 0 && <option value="">None available</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select label="Teacher" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
            {teachers.length === 0 && <option value="">None available</option>}
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.first_name} {t.last_name} — {t.subject}</option>
            ))}
          </Select>
          <Input
            label="Room"
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
            placeholder="e.g. R-12"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conflicts (same teacher, section or room at that slot) are rejected by the backend with a
            422 message shown below.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Slot'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
