import apiClient from './client';

export interface PaymentSettings {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  reference_hint: string | null;
  instructions: string | null;
  school_name: string | null;
  school_phone: string | null;
  school_email: string | null;
  school_address: string | null;
}

export interface SchoolSettingRow {
  id?: number;
  key: string;
  value: string | null;
  group: string;
  type?: string;
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const { data } = await apiClient.get<PaymentSettings>('/settings/payment');
  return data;
}

export async function fetchSettings(group?: string): Promise<SchoolSettingRow[]> {
  const { data } = await apiClient.get<SchoolSettingRow[]>('/settings', {
    params: group ? { group } : undefined,
  });
  return data;
}

export async function saveSettings(settings: SchoolSettingRow[]): Promise<SchoolSettingRow[]> {
  const { data } = await apiClient.put<SchoolSettingRow[]>('/settings', {
    settings: settings.map((s) => ({ key: s.key, value: s.value })),
  });
  return data;
}
