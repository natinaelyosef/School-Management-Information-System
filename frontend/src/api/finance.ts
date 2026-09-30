import apiClient from './client';
import type { Invoice, Paginated } from '../types';

export type ProofStatus =
  | 'pending'
  | 'under_verification'
  | 'more_information_required'
  | 'verified'
  | 'rejected';

export interface ProofFile {
  id: number;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  uploaded_at?: string | null;
  created_at: string;
}

export interface VerificationEntry {
  id: number;
  action: string;
  comment: string | null;
  verified_at: string | null;
}

export interface PaymentRow {
  id: number;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  status: ProofStatus;
  created_at: string;
  student?: { id: number; first_name: string; last_name: string; full_name?: string; admission_no?: string } | null;
  invoice?: { id: number; invoice_no: string; total: number | string; balance: number | string } | null;
  proofs?: ProofFile[];
  verifications?: VerificationEntry[];
}

export async function fetchInvoices(params: { student_id?: number | null } = {}): Promise<Invoice[]> {
  const { data } = await apiClient.get<Invoice[] | Paginated<Invoice>>('/invoices', {
    params: params.student_id ? { student_id: params.student_id } : {},
  });
  return Array.isArray(data) ? data : data.data;
}

export async function fetchInvoice(id: number) {
  const { data } = await apiClient.get(`/invoices/${id}`);
  return data;
}

export interface ProofPayload {
  invoice_id: number;
  amount: number;
  payment_date: string;
  bank?: string;
  reference?: string;
  note?: string;
  receipt: File;
}

/** Parent uploads a bank-transfer screenshot against an invoice. */
export async function submitPaymentProof(payload: ProofPayload): Promise<PaymentRow> {
  const fd = new FormData();
  fd.append('invoice_id', String(payload.invoice_id));
  fd.append('amount', String(payload.amount));
  fd.append('payment_date', payload.payment_date);
  if (payload.bank) fd.append('bank', payload.bank);
  if (payload.reference) fd.append('reference', payload.reference);
  if (payload.note) fd.append('note', payload.note);
  fd.append('receipt', payload.receipt);

  const { data } = await apiClient.post<PaymentRow>('/payment-proofs', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchVerificationQueue(): Promise<PaymentRow[]> {
  const { data } = await apiClient.get<PaymentRow[] | Paginated<PaymentRow>>('/payments/queue');
  return Array.isArray(data) ? data : data.data;
}

export async function fetchPayments(): Promise<PaymentRow[]> {
  const { data } = await apiClient.get<PaymentRow[] | Paginated<PaymentRow>>('/payments');
  return Array.isArray(data) ? data : data.data;
}

export type VerifyAction = 'verified' | 'rejected' | 'more_information_required';

export async function verifyPayment(
  id: number,
  action: VerifyAction,
  comment?: string,
): Promise<PaymentRow> {
  const { data } = await apiClient.post<PaymentRow>(`/payments/${id}/verify`, {
    action,
    comment,
    channel: 'message',
  });
  return data;
}

/** Fetch an uploaded receipt as an authenticated blob URL (Sanctum needs the header). */
export async function fetchProofObjectUrl(proofId: number): Promise<string> {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
  const token = localStorage.getItem('smis_token');
  const res = await fetch(`${base}/payment-proofs/${proofId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Could not load receipt');
  return URL.createObjectURL(await res.blob());
}
