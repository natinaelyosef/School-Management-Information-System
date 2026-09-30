import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  ArrowRight,
  School,
} from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { submitContact, type ContactPayload } from '../../api/public';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../stores/SchoolContext';

const TYPES: Array<{ value: ContactPayload['type']; label: string }> = [
  { value: 'general', label: 'General question' },
  { value: 'admission', label: 'Admission Inquiry' },
  { value: 'appointment', label: 'School Appointment' },
  { value: 'visit', label: 'Campus Tour & Visit' },
  { value: 'callback', label: 'Request Call Back' },
  { value: 'other', label: 'Other' },
];

export default function Contact() {
  const { t } = useTranslation();
  const { name, address, phone, email } = useSchool();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'general',
    subject: '',
    message: '',
    preferred_contact: 'email',
  });
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        type: form.type,
        subject: form.subject.trim() || null,
        message: form.message.trim(),
        preferred_contact: form.preferred_contact as 'email' | 'phone',
      });
      setReference(res.reference);
      setForm((f) => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'Your message could not be sent. Please check the backend connection and try again.',
        ),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Header */}
      <div className="max-w-2xl">
        <Badge tone="blue">Get in Touch</Badge>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
          {t('pages.contact.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Have questions regarding admissions, curriculum, or visiting our campus? Reach out to us
          and our team will gladly assist you.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Campus Info Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Campus Headquarters
            </h3>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <MapPin size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">School Address</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {address || t('public.addressUnknown')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Phone size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Phone Support</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {phone || '+251 11 000 0000'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Mail size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Email Address</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                    {email || 'admissions@school.edu.et'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Clock size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Office Working Hours</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Monday – Friday: 8:00 AM – 5:00 PM
                    <br />
                    Saturday: 8:30 AM – 12:30 PM
                  </p>
                </div>
              </div>
            </div>

            {/* Quick action card */}
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/50 p-4 border border-blue-100 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                <School size={16} />
                <span>Admissions Open</span>
              </div>
              <p className="mt-1 text-slate-600 dark:text-blue-300">
                You can submit an online student application anytime.
              </p>
              <Link
                to="/apply"
                className="mt-3 inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 hover:underline"
              >
                <span>{t('public.apply')}</span> <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Form Card */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Send us an Inquiry
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Fill in your details below and we will get back to you promptly.
            </p>

            {reference && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-bold">Thank you — inquiry received!</p>
                  <p className="mt-0.5">
                    Your reference number is: <strong>{reference}</strong>. We will reply via your
                    preferred contact method.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
                {error}
              </p>
            )}

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={set('name')}
                  required
                />
                <Input
                  label={t('common.email')}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Phone (optional)"
                  placeholder="+251 ..."
                  value={form.phone}
                  onChange={set('phone')}
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Topic
                  </span>
                  <select
                    value={form.type}
                    onChange={set('type')}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-600"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Input
                label="Subject (optional)"
                placeholder="Short summary of your question"
                value={form.subject}
                onChange={set('subject')}
              />

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Message
                </span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm outline-none focus:border-blue-600"
                  rows={4}
                  placeholder="How can we help you?"
                  value={form.message}
                  onChange={set('message')}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Preferred Reply Method
                </span>
                <select
                  value={form.preferred_contact}
                  onChange={set('preferred_contact')}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-600"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone Call</option>
                </select>
              </label>

              <div className="pt-2">
                <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                  {sending ? 'Sending…' : 'Send Message'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
