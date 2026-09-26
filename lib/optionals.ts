/**
 * The five optionals, and the two names each one answers to.
 *
 * A subscription, a profile and the payment routes all say
 * `political-science`; the pages that serve that subject live under `/polsci`.
 * The same is true of `public-administration` and `/pub-admin`. That pair of
 * spellings had been rewritten by hand in the dashboard, the chat, the test
 * page, the evaluate page and the admin views, which is the kind of thing that
 * drifts quietly — so anything new reads it from here.
 */

export type OptionalId =
  | 'sociology'
  | 'anthropology'
  | 'geography'
  | 'political-science'
  | 'public-administration';

type OptionalMeta = {
  /** Shown to the reader. */
  label: string;
  /** Path segment: /notes/<slug>, /<slug>/pyqs. */
  slug: string;
};

export const OPTIONALS: Record<OptionalId, OptionalMeta> = {
  sociology: { label: 'Sociology', slug: 'sociology' },
  anthropology: { label: 'Anthropology', slug: 'anthropology' },
  geography: { label: 'Geography', slug: 'geography' },
  'political-science': { label: 'PSIR', slug: 'polsci' },
  'public-administration': { label: 'Public Administration', slug: 'pub-admin' },
};

export function isOptionalId(value: unknown): value is OptionalId {
  return typeof value === 'string' && value in OPTIONALS;
}

/** The route slug for an optional, or null if it is not one of the five. */
export function routeSlugForOptional(optional: unknown): string | null {
  return isOptionalId(optional) ? OPTIONALS[optional].slug : null;
}

/** The reader-facing label, or null if it is not one of the five. */
export function labelForOptional(optional: unknown): string | null {
  return isOptionalId(optional) ? OPTIONALS[optional].label : null;
}

/* ─── The reader's own optional, shared across the app ──────────────────── */

/** Where the navbar remembers the optional between navigations. */
export const OPTIONAL_KEY = 'dc-optional';

/** Fired when the optional changes within this tab. */
const OPTIONAL_EVENT = 'dc:optional-changed';

/**
 * Announce a newly chosen optional.
 *
 * Changing optional does not change the Firebase user, and onboarding returns
 * to the dashboard by client navigation, so nothing the navbar watches would
 * otherwise tell it to look again: the bar kept the previous subject's links
 * until a full page load. The `storage` event covers a reader's other tabs but
 * pointedly not the tab that wrote the value, hence the custom event too.
 */
export function publishOptional(next: string | null): void {
  try {
    if (next) localStorage.setItem(OPTIONAL_KEY, next);
    else localStorage.removeItem(OPTIONAL_KEY);
  } catch {
    // Private browsing and blocked site data. The listener still fires, and
    // the navbar's own fetch is the source of truth regardless.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIONAL_EVENT, { detail: next }));
  }
}

/** Listen for optional changes, in this tab and in the reader's others. */
export function subscribeOptional(onChange: (next: string | null) => void): () => void {
  const fromCustom = (e: Event) => onChange((e as CustomEvent<string | null>).detail ?? null);
  const fromStorage = (e: StorageEvent) => {
    if (e.key === OPTIONAL_KEY) onChange(e.newValue);
  };
  window.addEventListener(OPTIONAL_EVENT, fromCustom);
  window.addEventListener('storage', fromStorage);
  return () => {
    window.removeEventListener(OPTIONAL_EVENT, fromCustom);
    window.removeEventListener('storage', fromStorage);
  };
}
