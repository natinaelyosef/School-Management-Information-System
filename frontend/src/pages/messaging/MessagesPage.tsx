import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, MessageSquare, Paperclip, Send, Star, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import {
  downloadAttachment,
  fetchConversations,
  fetchConversationMessages,
  fetchInbox,
  fetchMessageContacts,
  fetchMessageDepartments,
  fetchSent,
  sendConversationMessage,
  sendMessage,
  toggleStar,
  type ComposePayload,
} from '../../api/messaging';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import type { Message } from '../../types';
import { useTranslation } from 'react-i18next';

const CONTEXTS: Array<ComposePayload['context']> = ['general', 'fees', 'grades', 'attendance'];

const CONTEXT_TONE: Record<string, 'yellow' | 'blue' | 'purple' | 'slate'> = {
  fees: 'yellow',
  grades: 'blue',
  attendance: 'purple',
  general: 'slate',
};

export default function MessagesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'inbox' | 'sent' | 'starred' | 'threads'>('inbox');
  const [compose, setCompose] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [form, setForm] = useState<ComposePayload>({
    subject: '',
    body: '',
    context: 'general',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const inboxQ = useQuery({ queryKey: ['messages', 'inbox'], queryFn: fetchInbox, retry: false });
  const sentQ = useQuery({ queryKey: ['messages', 'sent'], queryFn: fetchSent, retry: false });
  const contactsQ = useQuery({
    queryKey: ['messages', 'contacts'],
    queryFn: fetchMessageContacts,
    enabled: compose,
    retry: false,
    staleTime: 60_000,
  });
  const departmentsQ = useQuery({
    queryKey: ['messages', 'departments'],
    queryFn: fetchMessageDepartments,
    enabled: compose,
    retry: false,
    staleTime: 60_000,
  });
  const threadsQ = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: fetchConversations,
    retry: false,
    enabled: tab === 'threads',
  });

  // ---- open thread ---------------------------------------------------------
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [threadError, setThreadError] = useState('');

  const threadQ = useQuery({
    queryKey: ['messages', 'thread', openThreadId],
    queryFn: () => fetchConversationMessages(openThreadId as number),
    enabled: openThreadId !== null,
    retry: false,
  });

  const reply = useMutation({
    mutationFn: () => sendConversationMessage(openThreadId as number, { body: replyBody, file: replyFile }),
    onSuccess: () => {
      setReplyBody('');
      setReplyFile(null);
      setThreadError('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['messages', 'thread', openThreadId] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'threads'] });
    },
    onError: (err) => setThreadError(apiErrorMessage(err, 'The reply could not be sent.')),
  });

  const attachment = useMutation({
    mutationFn: downloadAttachment,
    onError: (err) => setThreadError(apiErrorMessage(err, 'The attachment could not be downloaded.')),
  });

  const inbox = inboxQ.data ?? [];
  const sent = sentQ.data ?? [];
  const list =
    tab === 'inbox'
      ? inbox
      : tab === 'sent'
        ? sent
        : tab === 'starred'
          ? inbox.filter((m) => m.is_starred)
          : [];
  const unread = inbox.filter((m) => !m.is_read).length;

  const departments = departmentsQ.data ?? [];
  const chosenDepartment = recipient.startsWith('role:')
    ? departments.find((d) => d.name === recipient.slice('role:'.length))
    : undefined;
  const recipientCount = chosenDepartment ? Math.max(0, chosenDepartment.members - 1) : 0;

  const send = useMutation({
    mutationFn: () => {
      if (!recipient) {
        throw new Error('Choose somebody to message.');
      }
      const payload: ComposePayload = {
        subject: form.subject,
        body: form.body,
        context: form.context,
      };
      if (recipient.startsWith('user:')) {
        payload.recipient_id = Number(recipient.slice('user:'.length));
      } else {
        payload.recipient_role = recipient.replace(/^role:/, '');
      }
      return sendMessage(payload);
    },
    onSuccess: (sent_) => {
      invalidate();
      setForm({ subject: '', body: '', context: 'general' });
      setRecipient('');
      setTab('sent');
      setCompose(false);
      setError('');
      setNotice(
        sent_.broadcast
          ? `Delivered to ${sent_.recipients ?? 0} people in that department.`
          : 'Message sent.',
      );
    },
    onError: (err) => setError(apiErrorMessage(err, 'Message could not be sent.')),
  });

  const star = useMutation({
    mutationFn: toggleStar,
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          {t('nav.messages')}{' '}
          {unread > 0 && <span className="text-blue-700 dark:text-blue-300">({unread})</span>}
        </h1>
        <Button onClick={() => setCompose(true)}>
          <Send size={16} /> {t('common.compose')}
        </Button>
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        {(['inbox', 'sent', 'starred', 'threads'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${
              tab === t
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
            }`}
          >
            {t}
            {t === 'inbox' && unread > 0 && ` (${unread})`}
          </button>
        ))}
      </div>

      {tab === 'threads' ? (
        <div className="grid gap-3">
          {threadsQ.isLoading ? (
            <p className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading threads…</p>
          ) : (threadsQ.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {threadsQ.isError
                ? t('common.unavailable')
                : t('common.noResults')}
            </p>
          ) : (
            threadsQ.data?.map((c) => {
              const latest = c.messages?.[0];
              const others = (c.participants ?? []).map((p) => p.name).join(', ');
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpenThreadId(c.id);
                    setThreadError('');
                    setReplyBody('');
                    setReplyFile(null);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-50">
                      <MessageSquare size={16} className="text-blue-700 dark:text-blue-300" />
                      {c.subject || `Conversation #${c.id}`}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {c.last_message_at ? formatDate(c.last_message_at) : ''}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                    {latest?.body || (latest?.attachments?.length ? `${latest.attachments.length} attachment(s)` : 'No messages yet')}
                  </p>
                  {others && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">With {others}</p>}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {inboxQ.isLoading || sentQ.isLoading ? (
            <p className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : list.length === 0 ? (
            <p className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {tab === 'starred' ? 'No starred messages.' : 'No messages.'}
            </p>
          ) : (
            list.map((m: Message) => (
              <Card
                key={m.id}
                title={m.subject}
                subtitle={`${m.sender_name ?? 'Unknown'} • ${formatDate(m.created_at)}`}
                action={
                  <button
                    onClick={() => star.mutate(m.id)}
                    className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label={m.is_starred ? 'Unstar' : 'Star'}
                  >
                    <Star
                      size={16}
                      className={m.is_starred ? 'fill-yellow-400 text-yellow-400 dark:text-yellow-300' : ''}
                    />
                  </button>
                }
              >
                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{m.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {m.context && (
                    <Badge tone={CONTEXT_TONE[m.context] ?? 'slate'}>{m.context}</Badge>
                  )}
                  {!m.is_read && tab !== 'sent' && <Badge tone="green">Unread</Badge>}
                  {m.is_starred && <Badge tone="yellow">Starred</Badge>}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ---------------- Thread view with attachments ---------------- */}
      <Modal
        open={openThreadId !== null}
        title={threadsQ.data?.find((c) => c.id === openThreadId)?.subject || 'Conversation'}
        onClose={() => setOpenThreadId(null)}
      >
        <div className="space-y-3">
          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            {threadQ.isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading conversation…</p>
            ) : threadQ.isError ? (
              <p className="text-sm text-red-700 dark:text-red-300">
                {apiErrorMessage(threadQ.error, 'This conversation could not be loaded.')}
              </p>
            ) : (threadQ.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No messages in this thread yet.</p>
            ) : (
              [...(threadQ.data ?? [])].reverse().map((m) => (
                <div key={m.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {m.sender?.name ?? m.sender_name ?? 'Unknown'}
                    </span>
                    <span>{formatDate(m.created_at)}</span>
                  </div>
                  {m.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{m.body}</p>
                  )}
                  {(m.attachments ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments?.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => attachment.mutate(a)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          title={`Download ${a.original_name ?? 'attachment'}`}
                        >
                          <Paperclip size={12} />
                          <span className="max-w-[12rem] truncate">{a.original_name ?? 'attachment'}</span>
                          <Download size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!replyBody.trim() && !replyFile) return;
              reply.mutate();
            }}
            className="space-y-2"
          >
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Write a reply…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Paperclip size={14} />
                {replyFile ? replyFile.name : t('common.attach')}
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="flex items-center gap-2">
                {replyFile && (
                  <button
                    type="button"
                    onClick={() => setReplyFile(null)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Remove attachment"
                  >
                    <X size={14} />
                  </button>
                )}
                <Button type="submit" size="sm" disabled={reply.isPending || (!replyBody.trim() && !replyFile)}>
                  {reply.isPending ? t('campaigns.sending') : t('common.reply')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              JPG, PNG, PDF, Office or ZIP up to 10 MB.
            </p>
            {threadError && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
                {threadError}
              </p>
            )}
          </form>
        </div>
      </Modal>

      <Modal open={compose} title={t('common.compose')} onClose={() => setCompose(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
          className="space-y-3"
        >
          <Select label={t('common.to')} value={recipient} onChange={(e) => setRecipient(e.target.value)} required>
            <option value="">Choose a recipient…</option>
            <optgroup label="Whole department (broadcast)">
              {departments.map((d) => (
                <option key={d.name} value={`role:${d.name}`}>
                  {d.name.replace(/_/g, ' ')} — {d.members} member{d.members === 1 ? '' : 's'}
                </option>
              ))}
            </optgroup>
            {(contactsQ.data?.teachers.length ?? 0) > 0 && (
              <optgroup label="My child's teachers">
                {contactsQ.data?.teachers.map((t) => (
                  <option key={`t-${t.id}`} value={`user:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {(contactsQ.data?.parents.length ?? 0) > 0 && (
              <optgroup label="Parents of my students">
                {contactsQ.data?.parents.map((p) => (
                  <option key={`p-${p.id}`} value={`user:${p.id}`}>
                    {p.name}
                    {p.children?.length ? ` (${p.children.join(', ')})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {contactsQ.isError && (
              <option value={recipient} disabled>
                Contacts could not be loaded
              </option>
            )}
          </Select>

          {chosenDepartment && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">
              {recipientCount > 0
                ? `This goes to every one of the ${recipientCount} other member${
                    recipientCount === 1 ? '' : 's'
                  } of the ${chosenDepartment.name.replace(/_/g, ' ')} department.`
                : 'You are the only person in that department, so there is nobody to broadcast to.'}
            </p>
          )}

          <Select
            label={t('common.context')}
            value={form.context ?? 'general'}
            onChange={(e) =>
              setForm({ ...form, context: e.target.value as ComposePayload['context'] })
            }
          >
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Input
            label={t('campaigns.subject')}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
            maxLength={255}
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('campaigns.message')}
            </span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              required
              maxLength={5000}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
          </label>

          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCompose(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? t('campaigns.sending') : t('common.send')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
