import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import {
  fetchAttendance,
  fetchAttendanceSheet,
  markAttendance,
  updateAttendance,
} from '../../api/attendance';
import { fetchGrades, fetchSections } from '../../api/structure';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import type { AttendanceRecord, AttendanceStatus } from '../../types';
import { useTranslation } from 'react-i18next';

const OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const tone: Record<AttendanceStatus, 'green' | 'red' | 'yellow' | 'blue'> = {
  present: 'green',
  absent: 'red',
  late: 'yellow',
  excused: 'blue',
};

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type SheetRecord = AttendanceRecord & {
  student?: { first_name: string; last_name: string } | null;
};

export default function AttendanceMark() {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [gradePick, setGradePick] = useState('');
  const [sectionPick, setSectionPick] = useState('');
  const [overrides, setOverrides] = useState<Record<number, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const gradesQuery = useQuery({ queryKey: ['grades'], queryFn: fetchGrades, retry: 1 });
  const grades = useMemo(() => gradesQuery.data ?? [], [gradesQuery.data]);

  // Default to the first loaded option until the user picks something else.
  const gradeId = gradePick || (grades[0] ? String(grades[0].id) : '');

  const sectionsQuery = useQuery({
    queryKey: ['sections', gradeId],
    queryFn: () => fetchSections({ grade_id: gradeId }),
    enabled: Boolean(gradeId),
    retry: 1,
  });
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);

  const sectionId =
    sectionPick && sections.some((s) => String(s.id) === sectionPick)
      ? sectionPick
      : sections[0]
        ? String(sections[0].id)
        : '';

  const ready = Boolean(gradeId && sectionId);

  const rosterQuery = useQuery({
    queryKey: ['students', 'roster', gradeId, sectionId],
    queryFn: () =>
      fetchStudents(1, {
        grade_id: Number(gradeId),
        section_id: Number(sectionId),
        status: 'active',
        per_page: 200,
      }),
    enabled: ready,
    retry: 1,
  });
  const roster = useMemo(() => rosterQuery.data?.data ?? [], [rosterQuery.data]);

  const sheetsQuery = useQuery({
    queryKey: ['attendance', date, gradeId, sectionId],
    queryFn: () =>
      fetchAttendance({ date, grade_id: Number(gradeId), section_id: Number(sectionId), page: 1 }),
    enabled: ready,
    retry: 1,
  });

  const existingSheetId = sheetsQuery.data?.[0]?.id ?? null;

  const sheetQuery = useQuery({
    queryKey: ['attendance-sheet', existingSheetId],
    queryFn: () => fetchAttendanceSheet(existingSheetId!),
    enabled: Boolean(existingSheetId),
    retry: 1,
  });

  // Statuses already recorded for this class today, used until the user changes one.
  const recorded = useMemo(() => {
    const map = new Map<number, AttendanceStatus>();
    const records = sheetQuery.data?.records as SheetRecord[] | undefined;
    for (const record of records ?? []) {
      if (record.status) map.set(record.student_id, record.status);
    }
    return map;
  }, [sheetQuery.data]);

  const rows = useMemo(
    () =>
      roster.map((student) => ({
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`.trim(),
        status: overrides[student.id] ?? recorded.get(student.id) ?? 'present',
      })),
    [roster, overrides, recorded],
  );

  const counts = useMemo(
    () => OPTIONS.map((o) => ({ o, n: rows.filter((r) => r.status === o).length })),
    [rows],
  );

  const setStatus = (id: number, status: AttendanceStatus) =>
    setOverrides((prev) => ({ ...prev, [id]: status }));

  const markAll = (status: AttendanceStatus) =>
    setOverrides(Object.fromEntries(rows.map((row) => [row.student_id, status])));

  const save = async () => {
    if (!ready || rows.length === 0) return;
    setSaving(true);
    setMsg(null);
    const payload = rows.map((r) => ({ student_id: r.student_id, status: r.status }));
    try {
      if (existingSheetId) {
        await updateAttendance(existingSheetId, { records: payload });
      } else {
        await markAttendance({
          grade_id: Number(gradeId),
          section_id: Number(sectionId),
          date,
          records: payload,
        });
      }
      await sheetsQuery.refetch();
      await sheetQuery.refetch();
      setMsg({ tone: 'green', text: 'Attendance saved to backend.' });
    } catch (err) {
      setMsg({ tone: 'red', text: apiErrorMessage(err, 'Attendance could not be saved — is the backend running?') });
    } finally {
      setSaving(false);
    }
  };

  const gradeLabel = grades.find((g) => String(g.id) === gradeId)?.name ?? '';
  const sectionLabel = sections.find((s) => String(s.id) === sectionId)?.name ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
            Mark Attendance{gradeLabel ? ` — ${gradeLabel}${sectionLabel ? `-${sectionLabel}` : ''}` : ''}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {new Date(date).toDateString()} ·{' '}
            {existingSheetId ? 'Updating the sheet already recorded today' : 'New sheet for today'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markAll('present')} disabled={rows.length === 0}>
            All Present
          </Button>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {saving ? 'Saving…' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Grade" value={gradeId} onChange={(e) => setGradePick(e.target.value)}>
          <option value="">Select a grade</option>
          {grades.map((grade) => (
            <option key={grade.id} value={grade.id}>
              {grade.name}
            </option>
          ))}
        </Select>
        <Select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionPick(e.target.value)}
          disabled={!gradeId}
        >
          <option value="">Select a section</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {counts.map((c) => (
          <Badge key={c.o} tone={tone[c.o]}>{`${c.o}: ${c.n}`}</Badge>
        ))}
      </div>

      {msg && (
        <p
          className={`rounded-lg p-3 text-sm ${
            msg.tone === 'green'
              ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
          }`}
        >
          {msg.text}
        </p>
      )}

      {rosterQuery.isError && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          The class roster could not be loaded — check the backend connection, then refresh.
        </p>
      )}

      <Card>
        <div className="space-y-2">
          {!ready ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Choose a date, grade and section to load the roster.
            </p>
          ) : rosterQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading roster…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No active students in this class.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.student_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200">{r.student_name}</span>
                <div className="flex gap-1">
                  {OPTIONS.map((o) => (
                    <button
                      key={o}
                      onClick={() => setStatus(r.student_id, o)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                        r.status === o
                          ? 'bg-blue-700 text-white'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
