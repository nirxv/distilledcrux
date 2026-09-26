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
