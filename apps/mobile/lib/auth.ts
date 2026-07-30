import * as SecureStore from 'expo-secure-store';
import type { User } from '@ec/shared-types';

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync('user');
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function setStoredSession(token: string, user: User): Promise<void> {
  await SecureStore.setItemAsync('token', token);
  await SecureStore.setItemAsync('user', JSON.stringify(user));
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
  await SecureStore.deleteItemAsync('pinUserId');
}

/** Whether this device has a PIN set up for quick daily unlock, and for which user. */
export async function getPinUserId(): Promise<string | null> {
  return SecureStore.getItemAsync('pinUserId');
}

export async function setPinUserId(userId: string): Promise<void> {
  await SecureStore.setItemAsync('pinUserId', userId);
}
