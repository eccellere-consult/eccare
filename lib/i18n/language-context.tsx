'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
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

  const toggle = useCallback(() => {
    setOther((prevOther) => {
      if (!prevOther) return prevOther;
      const nextActive = prevOther;
      const nextOther = active;
      setActive(nextActive);
      fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: nextActive, secondaryLanguage: nextOther }),
      }).catch(() => {
        // Best-effort persistence — the toggle already flipped locally, and the
        // next page load will just re-read whatever's on the server.
      });
      return nextOther;
    });
  }, [active]);

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
