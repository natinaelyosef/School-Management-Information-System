import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, PhoneCall, Send, Trash2, UserPlus } from 'lucide-react';
import Table, { type Column } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import {
  contactApplication,
  decideApplication,
  deleteApplication,
  enrollApplication,
  fetchApplicationOffer,
  fetchApplications,
  notifyApplication,
  updateApplication,
  type ContactPayload,
  type EnrollResult,
  type NotifyResult,
} from '../../api/applications';
import { fetchGrades, fetchSections } from '../../api/structure';
import { apiErrorMessage } from '../../utils/errors';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../stores/AuthContext';
import type { Application, ApplicationStatus } from '../../types';
import { useTranslation } from 'react-i18next';

const TONES: Record<ApplicationStatus, 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'slate'> = {
  pending: 'blue',
  under_review: 'yellow',
  accepted: 'green',
  rejected: 'red',
  waitlisted: 'purple',
  suspended: 'red',
  enrolled: 'green',
};

const TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'under_review', label: 'Under review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'waitlisted', label: 'Waitlist' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'enrolled', label: 'Enrolled' },
];

const CONTACT_METHODS: ContactPayload['method'][] = ['phone', 'telegram', 'visit', 'sms', 'email'];

const fullName = (row: Application): string => `${row.first_name} ${row.last_name}`.trim();

export default function ApplicationsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canDecide = can('applications.decide');
  const canReview = can('applications.review');

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [offerOpen, setOfferOpen] = useState(false);
  const [contactForm, setContactForm] = useState<{ method: ContactPayload['method']; note: string }>({
    method: 'phone',
    note: '',
  });
  const [notifyResult, setNotifyResult] = useState<NotifyResult | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    grade_id: '',
    section_id: '',
    parent_password: '',
    notify: true,
  });
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);

  const query = useQuery({
    queryKey: ['applications', page, status],
    queryFn: () => fetchApplications({ page, status: status || undefined, per_page: 20 }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const offerQuery = useQuery({
    queryKey: ['application-offer', selected?.id],
    queryFn: () => fetchApplicationOffer(selected!.id),
    enabled: offerOpen && Boolean(selected),
    retry: 1,
  });

  const gradesQuery = useQuery({
    queryKey: ['grades'],
    queryFn: () => fetchGrades(),
    enabled: enrollOpen,
    retry: 1,
    staleTime: 300_000,
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: () => fetchSections(),
    enabled: enrollOpen,
    retry: 1,
    staleTime: 300_000,
  });

  const sectionsForGrade = useMemo(() => {
    const gradeId = Number(enrollForm.grade_id) || null;
    const all = sectionsQuery.data ?? [];
    if (!gradeId) return [];
    return all.filter((s) => s.grade_id === gradeId);
  }, [sectionsQuery.data, enrollForm.grade_id]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['applications'] });

  const closeDetail = () => {
    setSelected(null);
    setNotes('');
  };

  const decide = useMutation({
    mutationFn: (next: ApplicationStatus) => {
      if (!selected) throw new Error('No application selected');
      return decideApplication(selected.id, next, notes);
    },
    onSuccess: async (updated) => {
      setNotice(`${updated.application_no} marked ${updated.status.replace('_', ' ')}.`);
      setError('');
      closeDetail();
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The decision could not be saved.')),
  });

  const startReview = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No application selected');
      return updateApplication(selected.id, { status: 'under_review' });
    },
    onSuccess: async (updated) => {
      setNotice(`${updated.application_no} is now under review.`);
      setError('');
      setSelected(updated);
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The application could not be updated.')),
  });

  const remove = useMutation({
    mutationFn: deleteApplication,
    onSuccess: async () => {
      setNotice('Application deleted.');
      setError('');
      closeDetail();
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The application could not be deleted.')),
  });

  const contact = useMutation({
    mutationFn: (payload: ContactPayload) => {
      if (!selected) throw new Error('No application selected');
      return contactApplication(selected.id, payload);
    },
    onSuccess: async (updated) => {
      setSelected(updated);
      setContactForm({ method: 'phone', note: '' });
      setNotice(`Contact with ${fullName(updated)} (${updated.application_no}) recorded.`);
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The contact could not be recorded.')),
  });

  const notify = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No application selected');
      return notifyApplication(selected.id);
    },
    onSuccess: async (result) => {
      setNotifyResult(result);
      setSelected(result.application);
      setNotice('Acceptance message sent to the parent.');
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The acceptance message could not be sent.')),
  });

  const enroll = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No application selected');
      return enrollApplication(selected.id, {
        grade_id: Number(enrollForm.grade_id),
        section_id: enrollForm.section_id ? Number(enrollForm.section_id) : null,
        parent_password: enrollForm.parent_password || null,
        notify: enrollForm.notify,
      });
    },
    onSuccess: async (result) => {
      setEnrollResult(result);
      setSelected(result.application);
      setNotice(
        `Enrolled — admission number ${result.student.admission_no}` +
          (result.invoice ? `, invoice ${result.invoice.invoice_no}` : '') +
          '.',
      );
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The student could not be enrolled.')),
  });

  const openOffer = () => {
    setNotifyResult(null);
    setContactForm({ method: 'phone', note: '' });
    setError('');
    setOfferOpen(true);
  };

  const openEnroll = () => {
    setEnrollResult(null);
    setEnrollForm({ grade_id: '', section_id: '', parent_password: '', notify: true });
    setError('');
    setEnrollOpen(true);
  };

  const rows = query.data?.data ?? [];

  const columns: Column<Application>[] = [
    {
      key: 'application_no',
      header: 'Application',
      render: (r) => <span className="font-mono text-xs font-bold">{r.application_no}</span>,
    },
    {
      key: 'student',
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">{fullName(r)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {r.dob ? `born ${formatDate(r.dob)}` : 'no date of birth'}
            {r.gender ? ` · ${r.gender}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Parent',
      render: (r) => (
        <div>
          <p>{r.parent_name ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[r.parent_phone, r.parent_email].filter(Boolean).join(' · ') || 'no contact'}
          </p>
        </div>
      ),
    },
    { key: 'submitted_at', header: 'Submitted', render: (r) => (r.submitted_at ? formatDate(r.submitted_at) : '—') },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <Badge tone={TONES[r.status] ?? 'slate'}>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelected(r);
            setNotes(r.notes ?? '');
            setError('');
          }}
        >
          <Eye size={14} /> Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.applications.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('pages.applications.subtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
          <ClipboardList size={16} /> {query.data?.total ?? rows.length} applications
        </span>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {query.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(query.error, 'The admissions queue could not be loaded. Check the applications.view permission.')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              status === tab.value
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Table<Application>
        columns={columns}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading applications…'
            : query.isError
              ? 'No applications loaded.'
              : status
                ? `No ${status.replace('_', ' ')} applications.`
                : 'No applications yet — public forms land here as soon as they are submitted.'
        }
      />

      {query.data && query.data.last_page > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {query.data.current_page} / {query.data.last_page}
          </span>
          <Button variant="outline" size="sm" disabled={page >= query.data.last_page || query.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal open={selected !== null} title={selected ? `${selected.application_no} — ${fullName(selected)}` : 'Application'} onClose={closeDetail}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Status</p>
                <Badge tone={TONES[selected.status] ?? 'slate'}>{selected.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Submitted</p>
                <p className="text-slate-900 dark:text-slate-50">{selected.submitted_at ? formatDate(selected.submitted_at) : '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Parent</p>
                <p className="text-slate-900 dark:text-slate-50">{selected.parent_name ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[selected.parent_phone, selected.parent_email].filter(Boolean).join(' · ') || 'no contact'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">DOB / gender</p>
                <p className="text-slate-900 dark:text-slate-50">
                  {selected.dob ? formatDate(selected.dob) : '—'}
                  {selected.gender ? ` · ${selected.gender}` : ''}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Contacted</p>
                <p className="text-slate-900 dark:text-slate-50">
                  {selected.contacted_at ? `${formatDate(selected.contacted_at)} (${selected.contact_method})` : 'not yet'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Notified</p>
                <p className="text-slate-900 dark:text-slate-50">
                  {selected.notified_at ? formatDate(selected.notified_at) : 'not yet'}
                </p>
              </div>
              {selected.address && (
                <div className="col-span-2">
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Address</p>
                  <p className="text-slate-900 dark:text-slate-50">{selected.address}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="font-semibold text-slate-500 dark:text-slate-400">Documents on file</p>
                <p className="text-slate-900 dark:text-slate-50">{selected.documents?.length ?? 0}</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reviewer notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interview notes, documents outstanding…"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>

            {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {canReview ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete application ${selected.application_no}?`)) remove.mutate(selected.id);
                  }}
                >
                  <Trash2 size={14} /> {t('common.delete')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2">
                {selected.status === 'pending' && canReview && (
                  <Button size="sm" variant="outline" disabled={startReview.isPending} onClick={() => startReview.mutate()}>
                    Start review
                  </Button>
                )}
                {canDecide && (
                  <>
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate('waitlisted')}>
                      Waitlist
                    </Button>
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate('suspended')}>
                      Suspend
                    </Button>
                    <Button size="sm" variant="danger" disabled={decide.isPending} onClick={() => decide.mutate('rejected')}>
                      Decline
                    </Button>
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('accepted')}>
                      Approve
                    </Button>
                    {selected.status === 'accepted' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={openOffer}>
                          <PhoneCall size={14} /> Offer &amp; notify
                        </Button>
                        <Button size="sm" onClick={openEnroll}>
                          <UserPlus size={14} /> Enroll student
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {!canDecide && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can review this application, but only accounts with the applications.decide
                permission can approve, notify or enroll.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={offerOpen}
        title={selected ? `Offer & notify — ${selected.application_no}` : 'Offer & notify'}
        onClose={() => setOfferOpen(false)}
      >
        <div className="space-y-4">
          {offerQuery.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Loading offer details…</p>}
          {offerQuery.isError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {apiErrorMessage(offerQuery.error, 'The offer details could not be loaded.')}
            </p>
          )}

          {offerQuery.data && (
            <>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm">
                <p className="font-semibold text-slate-500 dark:text-slate-400">Parent contact</p>
                <p className="text-slate-900 dark:text-slate-50">
                  {offerQuery.data.parent.name ?? '—'} ·{' '}
                  {[offerQuery.data.parent.phone, offerQuery.data.parent.email].filter(Boolean).join(' · ') || 'no contact'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Fee for the grade</p>
                {offerQuery.data.fee ? (
                  <p className="mt-1 text-slate-900 dark:text-slate-50">
                    {offerQuery.data.fee.name} —{' '}
                    <strong>{formatCurrency(Number(offerQuery.data.fee.amount))}</strong>
                    {offerQuery.data.fee.frequency ? ` · ${offerQuery.data.fee.frequency}` : ''}
                    {offerQuery.data.fee.due_date ? ` · due ${formatDate(offerQuery.data.fee.due_date)}` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    No fee structure matches the applied grade yet — tell the parent the fee will be
                    confirmed with the invoice.
                  </p>
                )}
                <dl className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {[
                    ['Bank', offerQuery.data.payment.bank_name],
                    ['Account name', offerQuery.data.payment.account_name],
                    ['Account number', offerQuery.data.payment.account_number],
                    ['Reference', offerQuery.data.payment.reference_hint],
                  ].map(([label, value]) =>
                    value ? (
                      <div key={label} className="flex justify-between gap-3">
                        <dt className="font-semibold">{label}</dt>
                        <dd className="text-right">{value}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                {offerQuery.data.payment.instructions && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {offerQuery.data.payment.instructions}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Required documents</p>
                <ul className="mt-1 list-inside list-disc text-slate-700 dark:text-slate-300">
                  {offerQuery.data.documents.map((doc) => (
                    <li key={doc}>{doc}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3 text-sm">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Message to the parent</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {offerQuery.data.message}
                </p>
              </div>
            </>
          )}

          <div className="space-y-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">1. Log the phone call</p>
            <div className="flex flex-wrap gap-2">
              <Select
                label="Method"
                value={contactForm.method}
                onChange={(e) =>
                  setContactForm({ ...contactForm, method: e.target.value as ContactPayload['method'] })
                }
                className="w-36"
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <label className="flex-1">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Call note</span>
                <input
                  value={contactForm.note}
                  onChange={(e) => setContactForm({ ...contactForm, note: e.target.value })}
                  placeholder="Spoke with the parent, explained the fee…"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={contact.isPending || contactForm.note.trim().length === 0}
              onClick={() => contact.mutate({ method: contactForm.method, note: contactForm.note.trim() })}
            >
              <PhoneCall size={14} /> Record contact
            </Button>
          </div>

          <div className="space-y-2 rounded-lg bg-green-50 dark:bg-green-950/40 p-3">
            <p className="text-sm font-bold text-green-900 dark:text-green-200">2. Send the acceptance message</p>
            <p className="text-xs text-green-800 dark:text-green-300">
              Sends in-app + Telegram (when enabled) and creates the parent&apos;s portal account if
              they do not have one yet.
            </p>
            <Button size="sm" disabled={notify.isPending} onClick={() => notify.mutate()}>
              <Send size={14} /> {notify.isPending ? 'Sending…' : 'Send acceptance message'}
            </Button>
          </div>

          {notifyResult && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Sent</p>
              <p className="text-slate-600 dark:text-slate-300">
                Channels:{' '}
                {Object.keys(notifyResult.channels).length > 0
                  ? Object.entries(notifyResult.channels)
                      .map(([channel, state]) => `${channel} (${state})`)
                      .join(', ')
                  : 'in-app only'}
              </p>
              {notifyResult.parent_account && (
                <p className="mt-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-2 text-xs text-yellow-900 dark:text-yellow-200">
                  Parent portal account: <strong>{notifyResult.parent_account.email}</strong>
                  {notifyResult.parent_account.password && (
                    <>
                      {' '}· password <strong>{notifyResult.parent_account.password}</strong> (shown once —
                      give it to the parent during the call)
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setOfferOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={enrollOpen}
        title={selected ? `Enroll ${fullName(selected)}` : 'Enroll student'}
        onClose={() => setEnrollOpen(false)}
      >
        <div className="space-y-3">
          {enrollResult ? (
            <>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-900 dark:text-green-200">
                <p className="font-bold">Enrollment complete.</p>
                <p>
                  Admission number <strong>{enrollResult.student.admission_no}</strong>
                  {enrollResult.invoice && (
                    <>
                      {' '}· invoice <strong>{enrollResult.invoice.invoice_no}</strong> ·{' '}
                      {formatCurrency(Number(enrollResult.invoice.total))}
                    </>
                  )}
                </p>
                {enrollResult.parent_account && (
                  <p className="mt-2 text-xs">
                    Parent portal: <strong>{enrollResult.parent_account.email}</strong>
                    {enrollResult.parent_account.password && (
                      <>
                        {' '}· password <strong>{enrollResult.parent_account.password}</strong> (shown once)
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setEnrollOpen(false)}>Done</Button>
              </div>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!enrollForm.grade_id) {
                  setError('Choose the grade the student is joining.');
                  return;
                }
                setError('');
                enroll.mutate();
              }}
            >
              <Select
                label="Grade"
                value={enrollForm.grade_id}
                onChange={(e) => setEnrollForm({ ...enrollForm, grade_id: e.target.value, section_id: '' })}
                required
              >
                <option value="">Choose a grade…</option>
                {(gradesQuery.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Section (optional)"
                value={enrollForm.section_id}
                onChange={(e) => setEnrollForm({ ...enrollForm, section_id: e.target.value })}
                disabled={!enrollForm.grade_id}
              >
                <option value="">No section yet</option>
                {sectionsForGrade.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Parent portal password (optional)
                </span>
                <input
                  type="text"
                  value={enrollForm.parent_password}
                  onChange={(e) => setEnrollForm({ ...enrollForm, parent_password: e.target.value })}
                  placeholder="Leave blank to generate one"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                  checked={enrollForm.notify}
                  onChange={(e) => setEnrollForm({ ...enrollForm, notify: e.target.checked })}
                />
                Send the registration-complete message to the parent
              </label>
              {error && (
                <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={enroll.isPending || gradesQuery.isPending}>
                  {enroll.isPending ? 'Enrolling…' : 'Enroll & create invoice'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
