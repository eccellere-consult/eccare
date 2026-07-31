import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

function isConfigured() {
  return Boolean(
    process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY && process.env.FCM_CLIENT_EMAIL,
  );
}

function getApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FCM_PROJECT_ID,
      privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FCM_CLIENT_EMAIL,
    }),
  });
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: 'default' | 'emergency' | 'reminders';
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload) {
  if (!isConfigured()) {
    console.warn('[fcm] FCM_PROJECT_ID/FCM_PRIVATE_KEY/FCM_CLIENT_EMAIL not set — skipping push send.');
    return { sent: 0, failed: 0, skipped: true };
  }
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }

  const messaging = getMessaging(getApp());
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: {
      priority: 'high',
      notification: { channelId: payload.channelId ?? 'default' },
    },
  });

  return { sent: result.successCount, failed: result.failureCount, skipped: false };
}
