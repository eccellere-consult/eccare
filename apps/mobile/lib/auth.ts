import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  name: string | null;
  phone: string;
  role: 'elder' | 'caregiver' | 'admin';
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync('user');
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync('token');
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getStoredToken();
  return !!token;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('user');
}
