'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * The reader's language, one switch for the whole site.
 *
 * The English stays canonical: routes, slugs, progress keys and the database
 * never change. Hindi is a view of the same data, chosen here and remembered
 * in localStorage and in the dc-lang cookie, so a server render can also know
 * it. History Optional proved this shape; this is the same provider with the
 * cookie added, which is what lets a Hindi note arrive in Hindi on the first
 * paint instead of English → blank → Hindi.
 */

type LangContextType = {
  langHi: boolean;
  toggleLang: () => void;
  /** Shorthand for inline copy: L('Notes', 'नोट्स'). */
  L: (en: string, hi: string) => string;
};

const LangContext = createContext<LangContextType>({
  langHi: false,
  toggleLang: () => {},
  L: (en) => en,
});

const COOKIE = 'dc-lang';

function writeCookie(value: 'hi' | 'en') {
  document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [langHi, setLangHi] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'hi') setLangHi(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = langHi ? 'hi' : 'en';
    document.documentElement.dataset.lang = langHi ? 'hi' : 'en';
  }, [langHi]);

  // Another tab changed the language: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lang') setLangHi(e.newValue === 'hi');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleLang = () => {
    setLangHi((prev) => {
      const next = !prev;
      localStorage.setItem('lang', next ? 'hi' : 'en');
      writeCookie(next ? 'hi' : 'en');
      return next;
    });
  };

  const L = (en: string, hi: string) => (langHi ? hi : en);

  return <LangContext.Provider value={{ langHi, toggleLang, L }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
