'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { t as translate, type TranslationKey } from './dictionary';

interface LanguageContextValue {
  language: string;
  secondaryLanguage: string | null;
  t: (key: TranslationKey) => string;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  language,
  secondaryLanguage,
  children,
}: {
  language: string;
  secondaryLanguage: string | null;
  children: ReactNode;
}) {
  const [active, setActive] = useState(language);
  const [other, setOther] = useState(secondaryLanguage);
  const router = useRouter();

  const toggle = useCallback(() => {
    setOther((prevOther) => {
      if (!prevOther) return prevOther;
      const nextActive = prevOther;
      const nextOther = active;
      setActive(nextActive);
      // Every page under /elder that's a Client Component reads `active` from
      // this same context, so they flip instantly and stay in sync with each
      // other. But a couple of pages (Memories, Payments) are Server
      // Components that read the stored language fresh from the database on
      // each navigation — without a refresh, they'd keep showing whatever was
      // there before this toggle until the PUT below actually lands, i.e.
      // exactly the "some pages don't match the rest" symptom. Awaiting the
      // PUT before calling router.refresh() closes that gap: it re-fetches
      // every server-rendered segment (including those two pages) only once
      // the new language is actually persisted.
      fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextActive, secondaryLanguage: nextOther }),
      })
        .then(() => router.refresh())
        .catch(() => {
          // Best-effort persistence — the toggle already flipped locally, and the
          // next page load will just re-read whatever's on the server.
        });
      return nextOther;
    });
  }, [active, router]);

  const value: LanguageContextValue = {
    language: active,
    secondaryLanguage: other,
    t: (key) => translate(key, active),
    toggle,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue | null {
  return useContext(LanguageContext);
}
