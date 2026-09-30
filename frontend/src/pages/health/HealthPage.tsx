import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { createHealthRecord, createHealthVisit, fetchHealthRecords, fetchHealthVisits } from '../../api/health';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import type { HealthRecord, HealthVisit, Student } from '../../types';
import { useTranslation } from 'react-i18next';

export default function HealthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const visitsQuery = useQuery({ queryKey: ['health-visits'], queryFn: fetchHealthVisits, retry: false });
  const recordsQuery = useQuery({ queryKey: ['health-records'], queryFn: fetchHealthRecords, retry: false });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => fetchStudents(1), retry: false });

  const visits = visitsQuery.data ?? [];
  const records = recordsQuery.data ?? [];
  const students: Student[] = studentsQuery.data?.data ?? [];

  const defaultStudentId = String(students[0]?.id ?? '');

  const [visitOpen, setVisitOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [visitForm, setVisitForm] = useState(() => ({
    student_id: '',
    visit_date: new Date().toISOString().slice(0, 10),
    reason: '',
    diagnosis: '',
    treatment: '',
    temperature: '',
  }));
  const [recordForm, setRecordForm] = useState(() => ({
    student_id: '',
    record_date: new Date().toISOString().slice(0, 10),
    type: '',
    detail: '',
  }));

  const visitStudentId = visitForm.student_id || defaultStudentId;
  const recordStudentId = recordForm.student_id || defaultStudentId;

  const studentName = (id: number | string) => {
    const found = students.find((s) => String(s.id) === String(id));
    return found ? `${found.first_name} ${found.last_name}` : `Student #${id}`;
  };

  const saveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createHealthVisit({
        student_id: Number(visitStudentId),
        visit_date: visitForm.visit_date,
        reason: visitForm.reason,
        diagnosis: visitForm.diagnosis,
        treatment: visitForm.treatment,
        temperature: visitForm.temperature ? Number(visitForm.temperature) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['health-visits'] });
      setVisitOpen(false);
      setNotice('Visit recorded.');
      setVisitForm({ ...visitForm, reason: '', diagnosis: '', treatment: '', temperature: '' });
    } catch (err) {
      setError(apiErrorMessage(err, 'Backend unreachable — the visit was not saved.'));
    } finally {
      setBusy(false);
    }
  };

  const saveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createHealthRecord({
        student_id: Number(recordStudentId),
        record_date: recordForm.record_date,
        type: recordForm.type,
        detail: recordForm.detail,
      });
      await queryClient.invalidateQueries({ queryKey: ['health-records'] });
      setRecordOpen(false);
      setNotice('Health record added.');
      setRecordForm({ ...recordForm, type: '', detail: '' });
    } catch (err) {
      setError(apiErrorMessage(err, 'Backend unreachable — the record was not saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.health.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.health.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecordOpen(true)}>+ Health Record</Button>
          <Button onClick={() => setVisitOpen(true)}>+ New Visit</Button>
        </div>
      </div>

      {(visitsQuery.isError || recordsQuery.isError) && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(visitsQuery.error ?? recordsQuery.error, 'The health data could not be loaded.')}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-800 dark:text-green-200">{notice}</p>}

      <Card title="Visits" subtitle="Students seen at the health room">
        <Table<HealthVisit>
          columns={[
            { key: 'visit_date', header: t('common.date'), render: (r) => formatDate(r.visit_date) },
            { key: 'student_name', header: 'Student', render: (r) => r.student_name || studentName(r.student_id) },
            { key: 'reason', header: t('common.reason'), render: (r) => r.reason ?? '—' },
            { key: 'diagnosis', header: 'Diagnosis', render: (r) => r.diagnosis ?? '—' },
            { key: 'treatment', header: 'Treatment', render: (r) => r.treatment ?? '—' },
            { key: 'temperature', header: 'Temp °C', render: (r) => (r.temperature != null ? String(r.temperature) : '—') },
          ]}
          rows={visits}
          emptyText={
            visitsQuery.isPending
              ? 'Loading visits…'
              : visitsQuery.isError
                ? 'No visits loaded.'
                : 'No visits yet.'
          }
        />
      </Card>

      <Card title="Health Records" subtitle="Vaccinations, screenings and long-term notes">
        <Table<HealthRecord>
          columns={[
            { key: 'record_date', header: t('common.date'), render: (r) => formatDate(r.record_date) },
            { key: 'student_name', header: 'Student', render: (r) => r.student_name || studentName(r.student_id) },
            { key: 'type', header: t('common.type'), render: (r) => r.type ?? '—' },
            { key: 'detail', header: 'Detail', render: (r) => r.detail ?? '—' },
            { key: 'recorded_by', header: 'Recorded by', render: (r) => r.recorded_by ?? '—' },
          ]}
          rows={records}
          emptyText={
            recordsQuery.isPending
              ? 'Loading health records…'
              : recordsQuery.isError
                ? 'No health records loaded.'
                : 'No health records yet.'
          }
        />
      </Card>

      <Modal open={visitOpen} title="New Visit" onClose={() => setVisitOpen(false)}>
        <form onSubmit={saveVisit} className="space-y-3">
          <Select label="Student" value={visitStudentId} onChange={(e) => setVisitForm({ ...visitForm, student_id: e.target.value })} disabled={students.length === 0}>
            {students.length === 0 && <option value="">—</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.grade_level}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Visit date" type="date" value={visitForm.visit_date} onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })} required />
            <Input label="Temperature °C" type="number" step="0.1" value={visitForm.temperature} onChange={(e) => setVisitForm({ ...visitForm, temperature: e.target.value })} />
          </div>
          <Input label={t('common.reason')} value={visitForm.reason} onChange={(e) => setVisitForm({ ...visitForm, reason: e.target.value })} placeholder="e.g. Headache during class" required />
          <Input label="Diagnosis" value={visitForm.diagnosis} onChange={(e) => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />
          <Textarea label="Treatment" rows={2} value={visitForm.treatment} onChange={(e) => setVisitForm({ ...visitForm, treatment: e.target.value })} />
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setVisitOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy || !visitStudentId}>{busy ? 'Saving…' : 'Save Visit'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={recordOpen} title="New Health Record" onClose={() => setRecordOpen(false)}>
        <form onSubmit={saveRecord} className="space-y-3">
          <Select label="Student" value={recordStudentId} onChange={(e) => setRecordForm({ ...recordForm, student_id: e.target.value })} disabled={students.length === 0}>
            {students.length === 0 && <option value="">—</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.grade_level}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Record date" type="date" value={recordForm.record_date} onChange={(e) => setRecordForm({ ...recordForm, record_date: e.target.value })} required />
            <Input label="Type" value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })} placeholder="Vaccination, Vision…" required />
          </div>
          <Textarea label="Detail" rows={3} value={recordForm.detail} onChange={(e) => setRecordForm({ ...recordForm, detail: e.target.value })} required />
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRecordOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy || !recordStudentId}>{busy ? 'Saving…' : 'Save Record'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
