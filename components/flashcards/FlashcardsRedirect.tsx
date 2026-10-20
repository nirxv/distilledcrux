'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SubjectIcon from '@/components/SubjectIcon';
import { useOptional } from '@/components/useOptional';
import { routeSlugForOptional } from '@/lib/optionals';
import { FLASHCARD_SUBJECTS } from '@/lib/flashcardMeta';

const NAMES: Record<string, string> = {
  sociology: 'Sociology',
  anthropology: 'Anthropology',
  polsci: 'PSIR',
  geography: 'Geography',
  'pub-admin': 'Public Administration',
};

/**
 * Sends /flashcards on to the deck for the reader's own optional. Until the
 * optional is known, or for a reader who has not picked one, the five decks
 * are offered instead of a spinner that might never end.
 */
export default function FlashcardsRedirect() {
  const optional = useOptional();
  const router = useRouter();
  useEffect(() => {
    const slug = routeSlugForOptional(optional);
    if (slug) router.replace(`/${slug}/flashcards`);
  }, [optional, router]);

  return (
    <div className="fr ds">
      <style>{FR_CSS}</style>
      <div className="ds-container">
        <h1 className="ds-h1">Flashcards</h1>
        <p className="ds-lede">Pick an optional to start revising.</p>
        <div className="fr-grid">
          {FLASHCARD_SUBJECTS.map((s) => (
            <Link key={s} href={`/${s}/flashcards`} className="fr-deck ds-card ds-card-link" style={{ ['--t' as string]: `var(--tint-${s})` }}>
              <SubjectIcon id={s} size={22} />
              <span>{NAMES[s]}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const FR_CSS = `
.fr { min-height: var(--page-min-h, 60vh); padding: clamp(28px, 6vh, 64px) 0; background: var(--bg); }
.fr .ds-lede { margin: var(--space-2) 0 var(--space-5); }
.fr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); max-width: 920px; }
.fr-deck { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); font-weight: 700; color: var(--text); text-decoration: none; }
.fr-deck svg { color: var(--t); }
`;
