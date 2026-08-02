'use client';

import { useCallback, useEffect, useState } from 'react';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const err = new Error(json?.error?.message || 'Something went wrong. Please try again.');
    (err as Error & { code?: string }).code = json?.error?.code;
    throw err;
  }
  return json.data as T;
}

export const communityApi = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Fetch-on-mount with loading/error state and a manual refresh, so each community
 *  page doesn't re-implement the same three useStates. */
export function useCommunityData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      setData(await communityApi.get<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.');
      setErrorCode((err as Error & { code?: string })?.code ?? null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, errorCode, reload, setData };
}
