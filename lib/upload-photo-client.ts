import { shrinkPhoto } from '@/lib/shrink-photo';

/**
 * Sends one photo to an upload route from the browser, the same careful way everywhere:
 * the picture is shrunk first (a phone photo is 3-12 MB), one automatic retry follows a failure,
 * and a failure always comes back as a sentence a person can read, never a silent nothing.
 *
 * The retry is there because the very first photo request straight after saving a new item
 * sometimes fails on the host while the same request a moment later goes through.
 */
export async function uploadPhotoTo(url: string, picked: File, alreadyShrunk = false): Promise<void> {
  const file = alreadyShrunk ? picked : await shrinkPhoto(picked);
  const send = async () => {
    const body = new FormData();
    body.append('file', file);
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', credentials: 'include', body });
    } catch {
      throw new Error('The photo could not be sent. Please check the internet connection.');
    }
    const text = await res.text();
    let json: { success?: boolean; error?: { message?: string } } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok || !json?.success) {
      const reason = json?.error?.message || (text && !text.trim().startsWith('<') ? text.trim().slice(0, 120) : '');
      throw new Error(reason ? `${reason} (server answered ${res.status})` : `Something went wrong (server answered ${res.status}).`);
    }
  };
  try {
    await send();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await send();
  }
}
