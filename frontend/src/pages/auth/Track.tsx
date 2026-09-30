import { useState } from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { trackApplication, type TrackingResult } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const STEPS = ['Submitted', 'Under Review', 'Accepted', 'Enrolled'];

const stepIndex = (status: string): number => {
  switch (status) {
    case 'pending':
    case 'submitted':
      return 0;
    case 'under_review':
    case 'review':
      return 1;
    case 'accepted':
      return 2;
    case 'enrolled':
      return 3;
    default:
      return -1;
  }
};

const TONES: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = {
  accepted: 'green',
  enrolled: 'green',
  under_review: 'yellow',
  pending: 'yellow',
  submitted: 'yellow',
  rejected: 'red',
  waitlisted: 'blue',
};

export default function Track() {
  const { t } = useTranslation();
  const [code, setCode] = useState(localStorage.getItem('smis_last_tracking') ?? '');
  const [email, setEmail] = useState(localStorage.getItem('smis_last_tracking_email') ?? '');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !email.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await trackApplication({ code: code.trim().toUpperCase(), email: email.trim() });
      setResult(data);
      localStorage.setItem('smis_last_tracking', data.application_no);
      localStorage.setItem('smis_last_tracking_email', email.trim());
    } catch (err) {
      setError(apiErrorMessage(err, 'No application matches that number and email.'));
    } finally {
      setLoading(false);
    }
  };

  const current = result ? stepIndex(result.status) : -1;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.track.title')}</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Enter the application number you received after applying, plus the parent email.</p>
      <form onSubmit={check} className="mt-6 space-y-3">
        <Input placeholder="e.g. APP-2026-00042" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input label="Parent email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" disabled={loading}>{loading ? 'Checking…' : 'Check'}</Button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">{error}</p>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={TONES[result.status] ?? 'blue'}>{result.status.replace(/_/g, ' ')}</Badge>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{result.application_no}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {result.student} — submitted{' '}
            {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString() : '—'}
            {result.decided_at ? ` · decided ${new Date(result.decided_at).toLocaleDateString()}` : ''}
            {result.documents ? ` · ${result.documents} document(s) on file` : ''}
          </p>
          {result.notes && (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">{result.notes}</p>
          )}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-xs font-bold">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`rounded-xl px-2 py-2 text-center transition-colors ${
                  result.status === 'rejected'
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : i <= current
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
