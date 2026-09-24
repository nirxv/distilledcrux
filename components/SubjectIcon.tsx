/**
 * One icon set for the optional subjects, used everywhere they are shown.
 *
 * They were emoji before, and the emoji disagreed between surfaces: Sociology
 * was a puzzle piece on the home page and a pair of figures at onboarding,
 * and Public Administration was a clipboard on the home page but the same
 * classical building the site uses for History. The test page drew SVGs but
 * keyed them on 'psir' and 'pubadmin' while being handed 'polsci' and
 * 'pub-admin', so both fell through to the padlock meant for locked content.
 *
 * Every id that is in use anywhere on the site resolves here.
 */
import React from 'react';

export type SubjectIconId =
  | 'sociology' | 'anthropology' | 'polsci' | 'geography' | 'pub-admin' | 'history';

const ALIASES: Record<string, SubjectIconId> = {
  sociology: 'sociology',
  anthropology: 'anthropology',
  polsci: 'polsci',
  psir: 'polsci',
  'political-science': 'polsci',
  geography: 'geography',
  geo: 'geography',
  'pub-admin': 'pub-admin',
  pubadmin: 'pub-admin',
  'public-administration': 'pub-admin',
  history: 'history',
};

export function resolveSubjectIconId(id: string): SubjectIconId | null {
  return ALIASES[id] ?? null;
}

export default function SubjectIcon({
  id,
  color = 'currentColor',
  size = 16,
  style,
}: {
  id: string;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const key = resolveSubjectIconId(id);
  const common = {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    width: size,
    height: size,
    style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    'aria-hidden': true,
  };

  // Group of figures: the discipline of societies.
  if (key === 'sociology') return (
    <svg {...common}>
      <circle cx="5.2" cy="5" r="2.2" /><circle cx="10.8" cy="5" r="2.2" />
      <path d="M1.6 13.2c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4" />
      <path d="M8.4 10.2c.6-.3 1.3-.4 2-.4 2 0 3.6 1.4 3.6 3.4" />
    </svg>
  );

  // Double helix: biological and cultural human variation.
  if (key === 'anthropology') return (
    <svg {...common}>
      <path d="M5.4 2c0 3.4 5.2 4.6 5.2 6s-5.2 2.6-5.2 6" />
      <path d="M10.6 2c0 3.4-5.2 4.6-5.2 6s5.2 2.6 5.2 6" />
      <path d="M6 5.2h4M6 10.8h4" />
    </svg>
  );

  // Balance: politics and the weighing of claims.
  if (key === 'polsci') return (
    <svg {...common}>
      <path d="M8 3.2v10.3M5 13.5h6M3 5.2h10" />
      <path d="M3 5.2 1.4 8.8h3.2zM13 5.2l-1.6 3.6h3.2z" />
      <circle cx="8" cy="2.6" r=".9" />
    </svg>
  );

  // Globe with meridians.
  if (key === 'geography') return (
    <svg {...common}>
      <circle cx="8" cy="8" r="5.8" /><path d="M2.2 8h11.6" />
      <path d="M8 2.2c-2 1.9-3 3.9-3 5.8s1 3.9 3 5.8" />
      <path d="M8 2.2c2 1.9 3 3.9 3 5.8s-1 3.9-3 5.8" />
    </svg>
  );

  // Clipboard: the file, which is the unit of administration.
  if (key === 'pub-admin') return (
    <svg {...common}>
      <rect x="3" y="3" width="10" height="11" rx="1.3" />
      <path d="M6.2 3V2.2h3.6V3" /><path d="M5.6 7.2h4.8M5.6 10.2h3" />
    </svg>
  );

  // Colonnade.
  if (key === 'history') return (
    <svg {...common}>
      <path d="M1.8 6.6 8 2.8l6.2 3.8M2.4 13.6h11.2" />
      <path d="M4.4 13.6V7.4M7 13.6V7.4M9.6 13.6V7.4M12.2 13.6V7.4" />
    </svg>
  );

  // Unknown subject: a neutral book rather than the padlock, which means
  // "locked" elsewhere in the UI.
  return (
    <svg {...common}>
      <path d="M2.6 3.4h4a2 2 0 0 1 2 2v8a1.6 1.6 0 0 0-1.6-1.6H2.6z" />
      <path d="M13.4 3.4h-4a2 2 0 0 0-2 2v8a1.6 1.6 0 0 1 1.6-1.6h4.4z" />
    </svg>
  );
}
