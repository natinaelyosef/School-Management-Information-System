import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Landmark, Palette, School, Save } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { fetchSettings, saveSettings, type SchoolSettingRow } from '../../api/settings';
import { apiErrorMessage } from '../../utils/errors';
import { ThemeSegmented } from '../../components/ThemeToggle';
import { useTranslation } from 'react-i18next';

const PAYMENT_KEYS: Array<{ key: string; labelKey: string; hint?: string }> = [
  { key: 'payment_bank_name', labelKey: 'settings.bankName', hint: 'e.g. Commercial Bank of Ethiopia' },
  { key: 'payment_account_name', labelKey: 'settings.accountName' },
  { key: 'payment_account_number', labelKey: 'settings.accountNumber' },
  { key: 'payment_reference_hint', labelKey: 'settings.referenceHint' },
  { key: 'payment_instructions', labelKey: 'settings.extraInstructions' },
];

const SCHOOL_KEYS: Array<{ key: string; labelKey: string }> = [
  { key: 'school_name', labelKey: 'settings.schoolName' },
  { key: 'school_motto', labelKey: 'settings.motto' },
  { key: 'school_phone', labelKey: 'common.phone' },
  { key: 'school_email', labelKey: 'common.email' },
  { key: 'school_address', labelKey: 'settings.address' },
  { key: 'school_established', labelKey: 'settings.establishedYear' },
];

/**
 * Headline figures shown on the home page. The public site reads these keys, so
 * they are editable here rather than being frozen in the markup.
 */
const STAT_KEYS: Array<{ key: string; labelKey: string; hint: string }> = [
  { key: 'stat_students', labelKey: 'nav.students', hint: 'e.g. 2,500+' },
  { key: 'stat_teachers', labelKey: 'public.expertTeachers', hint: 'e.g. 120+' },
  { key: 'stat_levels', labelKey: 'public.levels', hint: 'e.g. 3' },
  { key: 'stat_years', labelKey: 'public.yearsExcellence', hint: 'e.g. 25+' },
];

const ALL_KEYS = [
  ...PAYMENT_KEYS.map((k) => k.key),
  ...SCHOOL_KEYS.map((k) => k.key),
  ...STAT_KEYS.map((k) => k.key),
];

function toMap(rows: SchoolSettingRow[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of ALL_KEYS) map[key] = '';
  for (const row of rows ?? []) map[row.key] = row.value ?? '';
  return map;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings(),
    retry: false,
  });

  // While the form is untouched it simply shows what the server holds, so a
  // background refetch can never overwrite half-typed input. Once the user
  // edits, their draft wins until it is saved.
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const values = draft ?? toMap(settingsQ.data);
  const setValue = (key: string, value: string) => setDraft({ ...values, [key]: value });

  const save = useMutation({
    mutationFn: () =>
      saveSettings(
        ALL_KEYS.map((key) => ({ key, value: values[key] ?? '', group: 'payment' })),
      ),
    onSuccess: () => {
      // Drop the draft so the form shows the stored values again.
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      // The public site reads the school name, so the navbar, footer and home
      // page must pick up the new value straight away.
      queryClient.invalidateQueries({ queryKey: ['public-site'] });
      setNotice(t('settings.savedNotice'));
    },
    onError: (err) => setNotice(apiErrorMessage(err, t('settings.saveFailed'))),
  });

  const field = (key: string, label: string, hint?: string) => (
    <Input
      label={label}
      value={values[key] ?? ''}
      onChange={(e) => setValue(key, e.target.value)}
      placeholder={hint}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.settings.title')}</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save size={16} /> {save.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {settingsQ.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {t('settings.loadFailed')}
        </p>
      )}

      <Card
        title={t('settings.paymentSettings')}
        subtitle={t('settings.paymentSettingsSubtitle')}
        action={<Landmark size={18} className="text-slate-400 dark:text-slate-500" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {PAYMENT_KEYS.map((k) => field(k.key, t(k.labelKey), k.hint))}
        </div>
        <div className="mt-4">
          <Textarea
            label={t('settings.paymentInstructions')}
            rows={3}
            value={values.payment_instructions ?? ''}
            onChange={(e) => setValue('payment_instructions', e.target.value)}
            placeholder="Transfer the fee, then upload the screenshot within 3 days…"
          />
        </div>
      </Card>

      <Card
        title={t('settings.schoolProfile')}
        subtitle={t('settings.schoolProfileSubtitle')}
        action={<School size={18} className="text-slate-400 dark:text-slate-500" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SCHOOL_KEYS.map((k) => field(k.key, t(k.labelKey)))}
        </div>
      </Card>

      <Card
        title={t('settings.publicFigures')}
        subtitle={t('settings.publicFiguresSubtitle')}
        action={<BarChart3 size={18} className="text-slate-400 dark:text-slate-500" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {STAT_KEYS.map((k) => field(k.key, t(k.labelKey), k.hint))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('settings.publicFiguresHint')}
        </p>
      </Card>

      <Card
        title={t('settings.appearance')}
        subtitle={t('settings.appearanceSubtitle')}
        action={<Palette size={18} className="text-slate-400 dark:text-slate-500" />}
      >
        <div className="flex flex-wrap items-center gap-4">
          <ThemeSegmented />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reports and printed pages always use the light theme.
          </p>
        </div>
      </Card>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Academic year, terms, levels, grades and sections are managed under Structure — see the
        Students and Academics areas. Only Super Admins and School Admins can edit these settings.
      </p>
    </div>
  );
}
