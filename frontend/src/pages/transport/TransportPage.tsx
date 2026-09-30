import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import {
  addTransportStop,
  createTransportRoute,
  fetchTransportRoute,
  fetchTransportRoutes,
} from '../../api/transport';
import { apiErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';
import type { TransportRoute } from '../../types';
import { useTranslation } from 'react-i18next';

export default function TransportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const routesQuery = useQuery({
    queryKey: ['transport-routes'],
    queryFn: fetchTransportRoutes,
    retry: 1,
  });
  const rows = routesQuery.data ?? [];

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TransportRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    name: '',
    driver_name: '',
    driver_phone: '',
    plate_no: '',
    model: '',
    fare: '',
    capacity: '',
    stops: '',
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['transport-routes'] });

  const reset = () =>
    setForm({
      name: '',
      driver_name: '',
      driver_phone: '',
      plate_no: '',
      model: '',
      fare: '',
      capacity: '',
      stops: '',
    });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const stops = form.stops
        .split(',')
        .map((stop) => stop.trim())
        .filter(Boolean);

      const route = await createTransportRoute({
        name: form.name,
        driver_name: form.driver_name || null,
        fare: form.fare ? Number(form.fare) : null,
        capacity: form.capacity ? Number(form.capacity) : null,
        vehicle: form.plate_no
          ? {
              plate_no: form.plate_no,
              model: form.model || null,
              capacity: form.capacity ? Number(form.capacity) : null,
              driver_name: form.driver_name || null,
              driver_phone: form.driver_phone || null,
            }
          : undefined,
      });

      // Stops are a separate resource: each comma-separated entry becomes a stop.
      for (const [index, name] of stops.entries()) {
        try {
          await addTransportStop(route.id, { name, order_index: index + 1 });
        } catch (stopError) {
          setError(apiErrorMessage(stopError, `Stop "${name}" could not be added.`));
        }
      }

      await refresh();
      setOpen(false);
      reset();
      setNotice('Transport route created.');
    } catch (err) {
      setError(apiErrorMessage(err, 'The route could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (route: TransportRoute) => {
    setDetail(route);
    setError('');
    try {
      const fresh = await fetchTransportRoute(route.id);
      setDetail(fresh);
    } catch {
      // Keep the list row data when the detail endpoint is unreachable.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.transport.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.transport.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ New Route</Button>
      </div>

      {routesQuery.isError && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          Routes could not be loaded — check the backend connection, then refresh.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-800 dark:text-green-200">{notice}</p>}

      <Table<TransportRoute>
        columns={[
          { key: 'name', header: 'Route', render: (r) => (r.code ? `${r.name} (${r.code})` : r.name) },
          { key: 'driver', header: 'Driver', render: (r) => r.driver ?? '—' },
          { key: 'phone', header: t('common.phone'), render: (r) => r.phone ?? '—' },
          { key: 'plate_no', header: 'Plate', render: (r) => r.plate_no ?? '—' },
          { key: 'fare', header: 'Fare', render: (r) => (r.fare != null ? formatCurrency(r.fare) : '—') },
          {
            key: 'capacity',
            header: 'Seats',
            render: (r) => (r.capacity != null ? <Badge tone="blue">{String(r.capacity)}</Badge> : '—'),
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                View
              </Button>
            ),
          },
        ]}
        rows={rows}
      />

      <Modal open={open} title="New Transport Route" onClose={() => setOpen(false)}>
        <form onSubmit={create} className="space-y-3">
          <Input
            label="Route name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Route 4 — Summit ⇄ School"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Driver"
              value={form.driver_name}
              onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
            />
            <Input
              label="Driver phone"
              value={form.driver_phone}
              onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Plate no"
              value={form.plate_no}
              onChange={(e) => setForm({ ...form, plate_no: e.target.value })}
            />
            <Input
              label="Fare (ETB)"
              type="number"
              min={0}
              value={form.fare}
              onChange={(e) => setForm({ ...form, fare: e.target.value })}
            />
            <Input
              label="Seats"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </div>
          <Input
            label="Vehicle model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="e.g. Toyota Coaster"
          />
          <Textarea
            label="Stops"
            rows={2}
            value={form.stops}
            onChange={(e) => setForm({ ...form, stops: e.target.value })}
            placeholder="Ayat, CMC, Mexico, Piassa, School"
          />
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Create Route'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title={detail?.name ?? 'Route detail'} onClose={() => setDetail(null)}>
        {detail && (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <p><span className="font-semibold">Driver:</span> {detail.driver ?? '—'}</p>
              <p><span className="font-semibold">Phone:</span> {detail.phone ?? '—'}</p>
              <p><span className="font-semibold">Plate:</span> {detail.plate_no ?? '—'}</p>
              <p><span className="font-semibold">Seats:</span> {detail.capacity ?? '—'}</p>
              <p><span className="font-semibold">Fare:</span> {detail.fare != null ? formatCurrency(detail.fare) : '—'}</p>
              <p><span className="font-semibold">Status:</span> {detail.is_active === false ? 'Inactive' : 'Active'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Stops</p>
              <p className="mt-1">{detail.stops ?? '—'}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetail(null)}>{t('common.close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
