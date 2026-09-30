import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, CheckCircle2, Eye, Upload, XCircle } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import {
  fetchInvoices,
  fetchProofObjectUrl,
  fetchVerificationQueue,
  submitPaymentProof,
  verifyPayment,
  type PaymentRow,
  type VerifyAction,
} from '../../api/finance';
import { fetchPaymentSettings, type PaymentSettings } from '../../api/settings';
import { apiErrorMessage } from '../../utils/errors';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../stores/AuthContext';
import { useOptionalChildren } from '../../stores/ChildContext';
import type { Invoice } from '../../types';
import { useTranslation } from 'react-i18next';

const STATUS_TONE: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'slate' | 'purple'> = {
  paid: 'green',
  partial: 'blue',
  unpaid: 'yellow',
  overdue: 'red',
  under_verification: 'purple',
  proof_submitted: 'purple',
  more_information_required: 'yellow',
  verified: 'green',
  rejected: 'red',
  pending: 'yellow',
};

const tone = (s: string) => STATUS_TONE[s] ?? 'slate';

function invoiceAmount(inv: Invoice): number {
  return Number(inv.amount ?? inv.total ?? 0);
}

function studentName(source: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
} | null | undefined): string {
  if (!source) return '—';
  const computed = source.full_name ?? `${source.first_name ?? ''} ${source.last_name ?? ''}`.trim();
  return computed || '—';
}

export default function FinancePage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { selectedId } = useOptionalChildren() ?? { selectedId: null };

  const isStaff = role === 'accountant' || role === 'super_admin' || role === 'principal';
  const isParent = role === 'parent';
  const childFilter = isParent ? (selectedId ?? null) : null;

  const invoiceQuery = useQuery({
    queryKey: ['invoices', childFilter ?? 'all'],
    queryFn: () => fetchInvoices(childFilter ? { student_id: childFilter } : {}),
    retry: false,
  });
  const settingsQuery = useQuery<PaymentSettings>({
    queryKey: ['payment-settings'],
    queryFn: fetchPaymentSettings,
    retry: false,
  });
  const queueQuery = useQuery({
    queryKey: ['payment-queue'],
    queryFn: fetchVerificationQueue,
    enabled: isStaff,
    retry: false,
  });

  const invoices = useMemo(() => invoiceQuery.data ?? [], [invoiceQuery.data]);
  const bank = settingsQuery.data;

  // ---- payment proof modal -------------------------------------------------
  const [proofFor, setProofFor] = useState<Invoice | null>(null);
  const [form, setForm] = useState({ amount: '', payment_date: '', bank: '', reference: '', note: '' });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [notice, setNotice] = useState('');

  const openProof = (inv: Invoice) => {
    setProofFor(inv);
    setForm({
      amount: String(inv.balance || 0),
      payment_date: new Date().toISOString().slice(0, 10),
      bank: bank?.bank_name ?? '',
      reference: '',
      note: '',
    });
    setReceipt(null);
    setNotice('');
  };

  const submitProof = useMutation({
    mutationFn: () => {
      if (!proofFor || !receipt) throw new Error('Receipt required');
      return submitPaymentProof({
        invoice_id: proofFor.id,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        bank: form.bank,
        reference: form.reference,
        note: form.note,
        receipt,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment-queue'] });
      setProofFor(null);
      setNotice('Payment proof submitted — the finance office will verify it.');
    },
    onError: (err) => setNotice(apiErrorMessage(err, 'Upload failed.')),
  });

  // ---- accountant verification --------------------------------------------
  const [review, setReview] = useState<PaymentRow | null>(null);
  const [comment, setComment] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');

  const openReview = async (payment: PaymentRow) => {
    setReview(payment);
    setComment('');
    setReceiptUrl(null);
    setReceiptError('');
    const proof = payment.proofs?.[payment.proofs.length - 1];
    if (proof) {
      try {
        setReceiptUrl(await fetchProofObjectUrl(proof.id));
      } catch {
        setReceiptError('Receipt could not be loaded.');
      }
    }
  };

  useEffect(() => () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
  }, [receiptUrl]);

  const verify = useMutation({
    mutationFn: ({ action }: { action: VerifyAction }) => {
      if (!review) throw new Error('No payment selected');
      return verifyPayment(review.id, action, comment || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-queue'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setReview(null);
    },
    onError: (err) => setNotice(apiErrorMessage(err, 'Verification failed.')),
  });

  const outstanding = useMemo(
    () => invoices.reduce((sum, i) => sum + Number(i.balance || 0), 0),
    [invoices],
  );
  const pendingProofs = queueQuery.data?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          {isStaff ? 'Finance — Verification' : 'Fees & Payments'}
        </h1>
        {isStaff && (
          <div className="flex gap-2 text-sm">
            <span className="rounded-lg bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 font-bold text-purple-800 dark:text-purple-200">
              {pendingProofs} awaiting verification
            </span>
            <span className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-1.5 font-bold text-red-800 dark:text-red-200">
              Outstanding {formatCurrency(outstanding)}
            </span>
          </div>
        )}
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {invoiceQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(invoiceQuery.error, 'Invoices could not be loaded.')}
        </p>
      )}
      {isParent && invoices.length === 0 && !invoiceQuery.isLoading && !invoiceQuery.isError && (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">
          No invoices for the selected child. Switch children in the header to see another account.
        </p>
      )}

      {isStaff && queueQuery.data && queueQuery.data.length > 0 && (
        <Card
          title="Payment Proofs Awaiting Verification"
          subtitle="Parents' bank-transfer receipts waiting for a decision"
        >
          <div className="space-y-3">
            {queueQuery.data.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-50">
                    {studentName(p.student)}
                    <span className="ml-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {p.invoice?.invoice_no}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {formatCurrency(Number(p.amount))} • {formatDate(p.payment_date)} •{' '}
                    {p.reference ? `ref ${p.reference}` : 'no reference'}
                  </p>
                  {p.verifications?.length ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Last action: {p.verifications[p.verifications.length - 1].action}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={tone(p.status)}>{p.status.replace(/_/g, ' ')}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openReview(p)}>
                    <Eye size={15} /> Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Table<Invoice>
        columns={[
          { key: 'invoice_no', header: 'Invoice' },
          {
            key: 'student_name',
            header: 'Student',
            render: (r) => r.student_name ?? studentName(r.student),
          },
          { key: 'amount', header: t('common.total'), render: (r) => formatCurrency(invoiceAmount(r)) },
          { key: 'amount_paid', header: 'Paid', render: (r) => formatCurrency(Number(r.amount_paid)) },
          { key: 'balance', header: 'Balance', render: (r) => formatCurrency(Number(r.balance)) },
          { key: 'due_date', header: 'Due', render: (r) => (r.due_date ? formatDate(r.due_date) : '—') },
          {
            key: 'status',
            header: t('common.status'),
            render: (r) => <Badge tone={tone(String(r.status))}>{String(r.status)}</Badge>,
          },
          {
            key: 'id',
            header: '',
            render: (r) =>
              Number(r.balance) > 0 ? (
                <Button size="sm" onClick={() => openProof(r)}>
                  <Upload size={14} /> Pay
                </Button>
              ) : null,
          },
        ]}
        rows={invoices}
      />

      {bank && (
        <Card title="School Payment Information" subtitle="Make the transfer before uploading your proof">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Bank</dt>
              <dd className="text-slate-900 dark:text-slate-50">{bank.bank_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Account Name</dt>
              <dd className="text-slate-900 dark:text-slate-50">{bank.account_name ?? bank.school_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Account Number</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-50">{bank.account_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Payment Reference</dt>
              <dd className="text-slate-900 dark:text-slate-50">{bank.reference_hint ?? 'Student ID / invoice number'}</dd>
            </div>
          </dl>
          {bank.instructions && (
            <p className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">{bank.instructions}</p>
          )}
        </Card>
      )}

      {/* ---------------- Parent: upload proof ---------------- */}
      <Modal open={Boolean(proofFor)} title="Upload Payment Proof" onClose={() => setProofFor(null)}>
        {proofFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitProof.mutate();
            }}
            className="space-y-3"
          >
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-bold">{proofFor.invoice_no}</p>
              <p className="mt-1">
                Total {formatCurrency(invoiceAmount(proofFor))} • Paid{' '}
                {formatCurrency(Number(proofFor.amount_paid))} • Outstanding{' '}
                <strong>{formatCurrency(Number(proofFor.balance))}</strong>
              </p>
            </div>

            <Input
              label="Amount transferred"
              type="number"
              step="0.01"
              min="0.01"
              max={String(proofFor.balance)}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Input
              label="Payment date"
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              required
            />
            <Input
              label="Bank"
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
              placeholder="Commercial Bank of Ethiopia"
            />
            <Input
              label="Transaction / reference number"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="TXN-000123"
            />
            <Input
              label="Note (optional)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Payment screenshot / receipt
              </span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950/40 file:bg-blue-950/40 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 hover:file:bg-blue-900/50"
                required
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG, WEBP or PDF up to 5 MB.</p>
            </div>

            {notice && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{notice}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProofFor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitProof.isPending || !receipt}>
                {submitProof.isPending ? 'Submitting…' : 'Submit Proof'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------------- Accountant: verify / reject / request info -------- */}
      <Modal
        open={Boolean(review)}
        title="Verify Payment Proof"
        onClose={() => {
          if (receiptUrl) URL.revokeObjectURL(receiptUrl);
          setReview(null);
        }}
      >
        {review && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Student</p>
                <p className="text-slate-900 dark:text-slate-50">{studentName(review.student)}</p>
                {review.student?.admission_no && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{review.student.admission_no}</p>
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Invoice</p>
                <p className="text-slate-900 dark:text-slate-50">{review.invoice?.invoice_no ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Balance {formatCurrency(Number(review.invoice?.balance ?? 0))}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Amount Claimed</p>
                <p className="font-bold text-slate-900 dark:text-slate-50">{formatCurrency(Number(review.amount))}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Paid On</p>
                <p className="text-slate-900 dark:text-slate-50">{formatDate(review.payment_date)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Reference</p>
                <p className="text-slate-900 dark:text-slate-50">{review.reference ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 dark:text-slate-400">Status</p>
                <Badge tone={tone(review.status)}>{review.status.replace(/_/g, ' ')}</Badge>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="border-b border-slate-100 dark:border-slate-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                Uploaded receipt
              </p>
              <div className="p-3">
                {receiptUrl ? (
                  <img
                    src={receiptUrl}
                    alt="Payment receipt"
                    className="max-h-72 w-full rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                  />
                ) : (
                  <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <AlertTriangle size={16} />
                    {receiptError || 'No receipt attached.'}
                  </p>
                )}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Comment (required when rejecting or requesting information)
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-blue-600"
                placeholder="e.g. Transaction confirmed in school account records."
              />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => verify.mutate({ action: 'more_information_required' })}
                disabled={verify.isPending || !comment.trim()}
              >
                Request More Info
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => verify.mutate({ action: 'rejected' })}
                disabled={verify.isPending || !comment.trim()}
              >
                <XCircle size={16} /> Reject
              </Button>
              <Button
                type="button"
                onClick={() => verify.mutate({ action: 'verified' })}
                disabled={verify.isPending}
              >
                <CheckCircle2 size={16} /> Approve Payment
              </Button>
            </div>

            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Banknote size={14} className="mt-0.5 shrink-0" />
              The screenshot is supporting evidence only — confirm the funds against the school's
              bank records before approving.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
