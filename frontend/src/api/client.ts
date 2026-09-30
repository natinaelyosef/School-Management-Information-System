import axios from 'axios';

const CONFIGURED = import.meta.env.VITE_API_URL as string | undefined;

const BASE_STORAGE_KEY = 'smis_api_base';

/**
 * Every backend origin this build is allowed to talk to. The first entry is the
 * configured one; the rest are the local dev servers (artisan serve + Apache).
 */
function candidates(): string[] {
  const list = [
    CONFIGURED,
    'http://localhost:8000/api/v1',
    `${window.location.origin}/api/v1`,
    'http://localhost/School%20Management%20%26%20Information%20System/backend/public/api/v1',
    'http://127.0.0.1:8000/api/v1',
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(list));
}

function initialBase(): string {
  try {
    const stored = localStorage.getItem(BASE_STORAGE_KEY);
    if (stored && candidates().includes(stored)) return stored;
  } catch {
    /* localStorage unavailable (SSR / private mode) */
  }
  return candidates()[0];
}

export const apiClient = axios.create({
  baseURL: initialBase(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/** Point the client at a different base and remember it across reloads. */
export function setApiBase(base: string): void {
  apiClient.defaults.baseURL = base;
  try {
    localStorage.setItem(BASE_STORAGE_KEY, base);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('smis:api-base', { detail: base }));
}

/** `http://host/api/v1` -> `http://host/api/health` (the route is unversioned). */
export function healthUrl(base: string): string {
  return `${base.replace(/\/v1\/?$/, '').replace(/\/$/, '')}/health`;
}

export type BackendStatus = {
  online: boolean;
  base: string;
  checkedAt: number;
  error?: string;
};

/**
 * Pings `/health` on the current base, then on every fallback until one answers.
 * Switches the client to the first reachable base so a port change (artisan serve
 * restarting on another port, Apache instead of the dev server) heals itself.
 */
export async function probeBackend(timeoutMs = 4000): Promise<BackendStatus> {
  const order = Array.from(
    new Set([apiClient.defaults.baseURL, ...candidates()].filter(Boolean) as string[]),
  );

  let lastError = 'Backend unreachable';

  for (const base of order) {
    try {
      const response = await axios.get(healthUrl(base), {
        timeout: timeoutMs,
        headers: { Accept: 'application/json' },
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        if (apiClient.defaults.baseURL !== base) setApiBase(base);
        return { online: true, base, checkedAt: Date.now() };
      }

      lastError = `Health check returned ${response.status}`;
    } catch (error) {
      const axiosError = error as { code?: string; message?: string };
      lastError = axiosError.code ?? axiosError.message ?? 'Backend unreachable';
    }
  }

  return { online: false, base: apiClient.defaults.baseURL ?? '', checkedAt: Date.now(), error: lastError };
}

// Attach Sanctum bearer token from localStorage on every request.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('smis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear stored auth so the router can redirect to /login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('smis_token');
      localStorage.removeItem('smis_user');
      localStorage.removeItem('smis_role');
    }
    return Promise.reject(error);
  },
);

export default apiClient;
