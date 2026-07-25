import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const configuredUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;

const BASE_URL = configuredUrl || (__DEV__ ? 'http://10.0.2.2:4000/api/v1' : 'https://eccare.in/api/v1');

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.error || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
