import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Trash2, Users } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import {
  createCampaign,
  deleteCampaign,
  fetchCampaigns,
  fetchCampaignTargets,
  type NotificationCampaign,
} from '../../api/campaigns';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../stores/AuthContext';
import { useTranslation } from 'react-i18next';

export default function CampaignsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canSend = can('campaigns.send');

  const [composeOpen, setComposeOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    optionIndex: '',
    title: '',
    body: '',
    channels: ['database'] as string[],
  });

  const targetsQuery = useQuery({ queryKey: ['campaign-targets'], queryFn: fetchCampaignTargets, retry: false });
  const listQuery = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns, retry: false });

  const options = targetsQuery.data?.options ?? [];
  const channels = targetsQuery.data?.channels ?? { database: true };
  const campaigns = listQuery.data?.data ?? [];
  const chosen = options[Number(form.optionIndex)];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-targets'] });
  };

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!chosen) throw new Error('Choose who to write to.');
      return createCampaign({
        title: form.title,
        body: form.body,
        audience: chosen.value,
        grade_id: chosen.grade_id,
        section_id: chosen.section_id,
        role: chosen.role,
        channels: form.channels,
      });
    },
    onSuccess: (sent) => {
      refresh();
      setComposeOpen(false);
      setForm({ optionIndex: '', title: '', body: '', channels: ['database'] });
      setError('');
      setNotice(
        `“${sent.title}” reached ${sent.recipients_count} ${sent.recipients_count === 1 ? 'person' : 'people'}` +
          (sent.failed_count > 0 ? ` (${sent.failed_count} deliveries failed)` : '') +
          '.',
      );
    },
    onError: (err) => setError(apiErrorMessage(err, 'The message could not be sent.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCampaign(id),
    onSuccess: () => {
      refresh();
      setNotice('Campaign record removed. Messages already delivered stay delivered.');
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) {
      setError('Choose who should receive this.');
      return;
    }
    if (!form.title.trim()) {
      setError('Give the message a subject.');
      return;
    }
    if (!form.body.trim()) {
      setError('Write the message itself.');
      return;
    }
    setBusy(true);
    setError('');
    sendMutation.mutate();
  };

  const toggleChannel = (name: string) => {
    setForm((prev) => {
      const next = prev.channels.includes(name)
        ? prev.channels.filter((c) => c !== name)
        : [...prev.channels.filter((c) => c !== 'database'), name];

      // The in-app feed is always delivered, so it can never be the only one dropped.
      return { ...prev, channels: next.includes('database') ? next : [...next, 'database'] };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('campaigns.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('campaigns.subtitle')}
          </p>
        </div>
        {canSend && (
          <Button onClick={() => setComposeOpen(true)}>
            <Megaphone size={16} /> {t('campaigns.write')}
          </Button>
        )}
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">
          {notice}
        </p>
      )}
      {listQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(listQuery.error, 'The campaign register could not be loaded.')}
        </p>
      )}

      <Table<NotificationCampaign>
        columns={[
          {
            key: 'title',
            header: t('campaigns.message'),
            render: (c) => (
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{c.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.label ?? c.audience}</p>
              </div>
            ),
          },
          {
            key: 'recipients',
            header: t('campaigns.reached'),
            render: (c) => (
              <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Users size={14} /> {c.recipients_count}
                {c.failed_count > 0 && (
                  <span className="ml-1 text-xs text-red-600 dark:text-red-400">({c.failed_count} failed)</span>
                )}
              </span>
            ),
          },
          {
            key: 'channels',
            header: t('campaigns.channels'),
            render: (c) => (
              <div className="flex flex-wrap gap-1">
                {(c.channels ?? ['database']).map((ch) => (
                  <Badge key={ch} tone="blue">
                    {t(`campaigns.${ch}`, ch)}
                  </Badge>
                ))}
              </div>
            ),
          },
          { key: 'sent_at', header: t('campaigns.sent'), render: (c) => (c.sent_at ? formatDate(c.sent_at) : '—') },
          { key: 'sender', header: t('campaigns.by'), render: (c) => c.sender?.name ?? '—' },
          {
            key: 'actions',
            header: '',
            render: (c) => (
              <Button
                size="sm"
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Remove the record for “${c.title}”?`)) deleteMutation.mutate(c.id);
                }}
              >
                <Trash2 size={14} /> {t('common.remove')}
              </Button>
            ),
          },
        ]}
        rows={campaigns}
        emptyText={listQuery.isPending ? t('common.loading') : t('common.noResults')}
      />

      <Modal open={composeOpen} title={t('campaigns.write')} onClose={() => setComposeOpen(false)}>
        <form className="space-y-3" onSubmit={submit}>
          <Select
            label={t('campaigns.audience')}
            value={form.optionIndex}
            onChange={(e) => setForm({ ...form, optionIndex: e.target.value })}
            required
          >
            <option value="">{t('campaigns.chooseAudience')}</option>
            {options.map((o, index) => (
              <option key={`${o.value}-${o.grade_id ?? o.section_id ?? o.role ?? 'all'}-${index}`} value={String(index)}>
                {o.label} — {o.count} {o.count === 1 ? 'person' : 'people'}
              </option>
            ))}
          </Select>

          {chosen && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">
              {chosen.count === 0
                ? 'Nobody matches this audience yet, so the message will be refused.'
                : `This goes to ${chosen.count} ${chosen.count === 1 ? 'person' : 'people'} and is also posted to the noticeboard.`}
            </p>
          )}

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('campaigns.channels')}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.keys(channels).map((name) => (
                <label
                  key={name}
                  className={`flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm ${
                    channels[name] ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                    checked={form.channels.includes(name)}
                    disabled={name === 'database'}
                    onChange={() => toggleChannel(name)}
                  />
                  {t(`campaigns.${name}`, name)}
                  {!channels[name] && <span className="text-xs">{t('campaigns.notConfigured')}</span>}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The in-app alert always goes out; families only receive SMS or Telegram if they opted in and
              have a contact number saved.
            </p>
          </fieldset>

          <Input
            label={t('campaigns.subject')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Parents meeting this Thursday"
            required
          />
          <Textarea
            label={t('campaigns.message')}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={5}
            required
          />

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || sendMutation.isPending || !chosen || chosen.count === 0}>
              <Send size={16} /> {sendMutation.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
