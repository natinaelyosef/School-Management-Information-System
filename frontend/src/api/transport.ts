import apiClient from './client';
import type { Paginated, TransportRoute } from '../types';

export interface RawVehicle {
  id?: number;
  plate_no?: string | null;
  model?: string | null;
  capacity?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

export interface RawRoute {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  driver_name?: string | null;
  fare?: number | null;
  capacity?: number | null;
  is_active?: boolean | null;
  vehicle?: RawVehicle | null;
  stops_count?: number;
  stops?: Array<{ id: number; name: string; order_index?: number | null }> | null;
  driver?: string | null;
  phone?: string | null;
  plate_no?: string | null;
}

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

/** Flattens the API's driver/vehicle relations into the fields the table renders. */
export function normalizeRoute(raw: RawRoute): TransportRoute {
  const stops = Array.isArray(raw.stops) ? raw.stops : null;

  return {
    id: raw.id,
    name: raw.name,
    code: raw.code ?? null,
    driver: raw.driver_name ?? raw.driver ?? raw.vehicle?.driver_name ?? null,
    phone: raw.vehicle?.driver_phone ?? raw.phone ?? null,
    plate_no: raw.vehicle?.plate_no ?? raw.plate_no ?? null,
    stops: stops
      ? stops.map((stop) => stop.name).join(', ') || null
      : typeof raw.stops === 'string'
        ? raw.stops
        : raw.stops_count != null
          ? `${raw.stops_count} stop${raw.stops_count === 1 ? '' : 's'}`
          : null,
    stops_count: raw.stops_count ?? stops?.length ?? null,
    fare: raw.fare ?? null,
    capacity: raw.capacity ?? raw.vehicle?.capacity ?? null,
    is_active: raw.is_active ?? true,
  };
}

export interface CreateRoutePayload {
  name: string;
  code?: string | null;
  description?: string | null;
  driver_name?: string | null;
  fare?: number | null;
  capacity?: number | null;
  vehicle?: {
    plate_no?: string;
    model?: string | null;
    capacity?: number | null;
    driver_name?: string | null;
    driver_phone?: string | null;
  };
}

export async function fetchTransportRoutes(): Promise<TransportRoute[]> {
  const { data } = await apiClient.get<RawRoute[] | Paginated<RawRoute>>('/transport/routes');
  return toList(data).map(normalizeRoute);
}

export async function createTransportRoute(payload: CreateRoutePayload): Promise<TransportRoute> {
  const { data } = await apiClient.post<RawRoute>('/transport/routes', payload);
  return normalizeRoute(data);
}

export async function fetchTransportRoute(id: number): Promise<TransportRoute> {
  const { data } = await apiClient.get<RawRoute>(`/transport/routes/${id}`);
  return normalizeRoute(data);
}

export async function addTransportStop(
  routeId: number,
  stop: { name: string; order_index?: number },
): Promise<void> {
  await apiClient.post(`/transport/routes/${routeId}/stops`, stop);
}
