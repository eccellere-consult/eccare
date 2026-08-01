'use client';

import { useState, useEffect, useCallback } from 'react';

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/health${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Request failed.');
  }
  return json.data as T;
}

export const healthApi = {
  get: <T>(path: string) => fetchApi<T>(path),
  post: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => fetchApi<T>(path, { method: 'DELETE' }),
};

export function useHealthData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    healthApi
      .get<T>(path)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, setData };
}
