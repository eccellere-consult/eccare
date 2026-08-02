// Web Contact Picker API — reads the device's native contact book (which is also
// what WhatsApp's contact list draws from, so this single control covers both asks).
// Only implemented in Chrome/Edge on Android and ChromeOS today — no iOS Safari, no
// desktop browser. Callers must feature-detect with isContactPickerSupported() before
// showing any picker UI; everywhere else, manual entry is the only path.

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactPickerResult[]>;
}

interface ContactPickerResult {
  name?: string[];
  tel?: string[];
}

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/** Opens the OS contact picker and returns the first selected contact's name+phone,
 *  or null if the user cancelled, no contact was returned, or the API is unsupported. */
export async function pickContact(): Promise<{ name: string; phone: string } | null> {
  if (!isContactPickerSupported()) return null;

  try {
    const contactsApi = (navigator as unknown as { contacts: ContactsManager }).contacts;
    const results = await contactsApi.select(['name', 'tel'], { multiple: false });
    const first = results[0];
    if (!first) return null;

    const name = first.name?.[0] ?? '';
    const phone = first.tel?.[0] ?? '';
    if (!phone) return null;

    return { name, phone };
  } catch {
    // User cancelled the picker, or the browser rejected the call.
    return null;
  }
}
