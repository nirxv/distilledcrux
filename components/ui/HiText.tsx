'use client';

import type { ReactNode } from 'react';
import { useLang } from '@/lib/i18n/LangContext';

/**
 * Words for a server-drawn page in both languages.
 *
 * The server sends the English, which is what crawlers read; a reader who has
 * Hindi on sees the Hindi after hydration, exactly as History Optional does.
 * Keeping it a client component means the layout, metadata and static pages
 * stay static — no per-request server render for a language switch.
 */
export function HiText({ en, hi }: { en: ReactNode; hi: ReactNode }) {
  const { langHi } = useLang();
  return <>{langHi ? hi : en}</>;
}
