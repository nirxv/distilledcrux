/**
 * The four PYQ detail pages were four copies of the same 500-line file that had
 * drifted apart: different accent handling, different badge order, different
 * copy, and one of them missing the section badge and the Topper's Copy card.
 * Everything that genuinely varies between them lives here.
 *
 * `accentPrefix` names an accent ramp in globals.css (--accent-*, --geo-*,
 * --psir-*). The shared stylesheet reads only --pd-* variables, which each
 * subject aliases onto its ramp, so the component itself holds no colours.
 */
export type PyqSubject = 'sociology' | 'anthropology' | 'polsci' | 'geography' | 'pub-admin';

export type PyqSubjectConfig = {
  /** Path segment and the value sent to the answer and model-answer APIs. */
  slug: PyqSubject;
  /** Shown in the breadcrumb, the model-answer heading and page titles. */
  label: string;
  /** Data file this subject's questions come from. */
  vars: string;
};

/**
 * Sociology and anthropology sit on the site accent; geography and PSIR have
 * their own ramps. `--pd-on-accent` is the label colour on a solid accent
 * button, which flips with the theme for the two bright ramps.
 */
const ramp = (name: string, onAccent: string) => `
  --pd-accent:        var(--${name});
  --pd-accent-dim:    var(--${name}-dim);
  --pd-accent-border: var(--${name}-border);
  --pd-accent-border2:var(--${name}-border2);
  --pd-on-accent:     ${onAccent};
`;

export const PYQ_SUBJECTS: Record<PyqSubject, PyqSubjectConfig> = {
  sociology: {
    slug: 'sociology',
    label: 'Sociology',
    vars: `
      --pd-accent:        var(--accent);
      --pd-accent-dim:    var(--accent-dim);
      --pd-accent-border: rgba(67,97,238,0.22);
      --pd-accent-border2:rgba(67,97,238,0.40);
      --pd-on-accent:     #fff;
    `,
  },
  anthropology: {
    slug: 'anthropology',
    label: 'Anthropology',
    vars: `
      --pd-accent:        var(--accent);
      --pd-accent-dim:    var(--accent-dim);
      --pd-accent-border: rgba(67,97,238,0.22);
      --pd-accent-border2:rgba(67,97,238,0.40);
      --pd-on-accent:     #fff;
    `,
  },
  polsci: {
    slug: 'polsci',
    label: 'PSIR',
    vars: ramp('psir', 'var(--psir-text-btn)'),
  },
  geography: {
    slug: 'geography',
    label: 'Geography',
    vars: ramp('geo', 'var(--geo-text-btn)'),
  },
  'pub-admin': {
    slug: 'pub-admin',
    label: 'Public Administration',
    vars: `
      --pd-accent:        var(--accent);
      --pd-accent-dim:    var(--accent-dim);
      --pd-accent-border: rgba(67,97,238,0.22);
      --pd-accent-border2:rgba(67,97,238,0.40);
      --pd-on-accent:     #fff;
    `,
  },
};

/** The union of the four data files. Only id, year, paper, question, marks and
 *  topic are present in all of them. */
export type PYQ = {
  id: number;
  year: string;
  paper: string;
  question: string;
  marks: number | null;
  topic: string;
  section?: string;
  microtheme?: string;
};
