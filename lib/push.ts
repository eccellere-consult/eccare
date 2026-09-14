/**
 * Sends push notifications via Expo's Push API (https://exp.host/--/api/v2/push/send).
 *
 * Renamed from lib/fcm.ts, which sent through the raw Firebase Admin SDK
 * (`sendEachForMulticast`) — but every DeviceToken this app ever stores comes
 * from the mobile app's `Notifications.getExpoPushTokenAsync()`
 * (eccare-mobile/lib/notifications.ts), which returns an Expo push token
 * (`ExponentPushToken[...]`), not a native FCM registration token. Firebase
 * Admin's `sendEachForMulticast` expects the latter, so every push sent
 * through the old code either no-op'd (FCM_* env vars were never set — see
 * git history) or would have failed outright even if they had been, since
 * an Expo token isn't a valid FCM token. Expo's own Push API accepts Expo
 * tokens directly and is what Expo apps are meant to send through — no
 * Firebase Admin credentials needed server-side at all.
 *
 * Note this doesn't by itself fix delivery: `getExpoPushTokenAsync()` still
 * needs the Android build to have FCM credentials configured via `eas
 * credentials` (a Firebase project + service account key, uploaded to EAS) —
 * without that, the mobile app never obtains a token to begin with (see the
 * comment in eccare-mobile/lib/notifications.ts). This file is the
 * send-side fix; the token-side fix is a one-time EAS/Firebase setup step
 * outside this codebase.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: 'default' | 'emergency' | 'reminders';
  /** iOS sound name, or 'default'. Android's sound is set per-channel on
   *  the device (see eccare-mobile/lib/notifications.ts), not per-push. */
  sound?: string;
}

/** Expo caps a single request at 100 messages. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload) {
  const validTokens = [...new Set(tokens)].filter((t) => EXPO_TOKEN_RE.test(t));
  if (validTokens.length === 0) {
    return { sent: 0, failed: tokens.length, skipped: tokens.length === 0 };
  }

  const messages = validTokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    channelId: payload.channelId ?? 'default',
    sound: payload.sound ?? 'default',
    priority: 'high' as const,
  }));

  let sent = 0;
  let failed = tokens.length - validTokens.length; // tokens that weren't Expo-shaped at all
  try {
    for (const batch of chunk(messages, 100)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null);
      const tickets: Array<{ status: string }> = json?.data ?? [];
      for (const ticket of tickets) {
        if (ticket.status === 'ok') sent += 1;
        else failed += 1;
      }
      // If the API itself rejected the whole batch (malformed request, etc.),
      // json.data won't exist — count the batch as failed rather than silently
      // reporting 0 sent / 0 failed.
      if (!Array.isArray(json?.data)) failed += batch.length;
    }
  } catch (err) {
    console.warn('[push] Expo push send failed:', err instanceof Error ? err.message : err);
    failed += validTokens.length - sent;
  }

  return { sent, failed, skipped: false };
}
