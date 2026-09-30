import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { PROGRAMS } from '../../utils/constants';
import { submitApplication, type ApplicationPayload } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const steps = ['Account', 'Program', 'Student Info', 'Documents'];

export default function Apply() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    program: PROGRAMS[0],
    grade: 'Grade 1',
    studentFirst: '',
    studentLast: '',
    dob: '',
    notes: '',
  });
  const [tracking, setTracking] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    const noteLines = [`Program: ${form.program}`, `Grade applying for: ${form.grade}`];
    if (form.notes.trim()) noteLines.push(form.notes.trim());

    const payload: ApplicationPayload = {
      parent_name: form.name.trim(),
      parent_email: form.email.trim(),
      parent_phone: form.phone.trim(),
      first_name: form.studentFirst.trim(),
      last_name: form.studentLast.trim(),
      dob: form.dob || null,
      note: noteLines.join('\n').slice(0, 1000),
    };

    setSending(true);
    setError('');
    try {
      const receipt = await submitApplication(payload);
      setTracking(receipt.application_no);
      localStorage.setItem('smis_last_tracking', receipt.application_no);
      localStorage.setItem('smis_last_tracking_email', payload.parent_email);
    } catch (err) {
      setError(apiErrorMessage(err, 'The application could not be submitted. Please check the backend connection and try again.'));
      setStep(steps.length - 1);
    } finally {
      setSending(false);
    }
  };

  if (tracking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">Application Submitted!</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Your application number is:</p>
        <p className="mx-auto mt-4 inline-block rounded-xl bg-blue-50 dark:bg-blue-950/40 px-6 py-3 text-2xl font-extrabold tracking-widest text-blue-800 dark:text-blue-200">{tracking}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Save this number. You will need it together with {form.email} on the tracking page.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate('/track')}>Track Application</Button>
          <Button variant="outline" onClick={() => navigate('/')}>Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-3 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
        Apply Now — Register
      </h1>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        Complete the online application to secure enrollment for the upcoming academic session.
      </p>

      {/* Responsive Step Indicator */}
      <div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-2.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`rounded-xl px-2 sm:px-3 py-2 text-center text-[11px] sm:text-xs font-bold transition-colors ${
              i <= step
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="block sm:inline">{i + 1}. </span>
            <span className="hidden sm:inline">{s}</span>
            <span className="sm:hidden">{s.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {error && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">{error}</p>
        )}
        {step === 0 && (
          <>
            <Input label="Parent full name" value={form.name} onChange={set('name')} required placeholder="e.g. Hanna Alemu" />
            <Input label={t('common.email')} type="email" value={form.email} onChange={set('email')} required />
            <Input label={t('common.phone')} value={form.phone} onChange={set('phone')} required placeholder="+251 ..." />
          </>
        )}
        {step === 1 && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Program</span>
              <select value={form.program} onChange={set('program')} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm">
                {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <Input label="Grade applying for" value={form.grade} onChange={set('grade')} required />
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Student first name" value={form.studentFirst} onChange={set('studentFirst')} required />
              <Input label="Student last name" value={form.studentLast} onChange={set('studentLast')} required />
            </div>
            <Input label="Date of birth" type="date" value={form.dob} onChange={set('dob')} required />
          </>
        )}
        {step === 3 && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Birth certificate / report card (upload at school office or attach later)</span>
              <input type="file" className="w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Additional notes</span>
              <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm" />
            </label>
          </>
        )}
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || sending}>
            Back
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? 'Submitting…' : step === steps.length - 1 ? 'Submit Application' : 'Continue'}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="font-bold text-blue-700 dark:text-blue-300">Already have an account? Login</Link>
      </p>
    </div>
  );
}
