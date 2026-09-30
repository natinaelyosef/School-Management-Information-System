interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Record<string, string[] | string>;
    };
  };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiErrorShape | undefined;
  const data = err?.response?.data;
  if (data?.message) return data.message;
  const first = data?.errors ? Object.values(data.errors)[0] : undefined;
  if (Array.isArray(first) && first[0]) return first[0];
  if (typeof first === 'string' && first) return first;
  return fallback;
}

export function isConflict(error: unknown): boolean {
  return (error as ApiErrorShape | undefined)?.response?.status === 422;
}
