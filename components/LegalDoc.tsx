import type { ReactNode } from 'react';
import Link from 'next/link';

const DOCS = [
  { id: 'privacy', label: 'Privacy', href: '/privacy' },
  { id: 'terms', label: 'Terms', href: '/terms' },
  { id: 'refund', label: 'Refunds', href: '/refund' },
] as const;

/**
 * The frame for the three policy pages: their own tabs, the title and dates,
 * and one readable style for the text. Each page carried a copy of the same
 * inline style table, with gold section headings.
 */
export default function LegalDoc({ current, title, updated, children }: {
  current: (typeof DOCS)[number]['id'];
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="lgd ds">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lgd-inner">
        <nav className="lgd-tabs" aria-label="Policies">
          {DOCS.map(d => (
            <Link key={d.id} href={d.href} className={`lgd-tab${d.id === current ? ' on' : ''}`} aria-current={d.id === current ? 'page' : undefined}>{d.label}</Link>
          ))}
        </nav>
        <h1 className="lgd-title">{title}</h1>
        <p className="lgd-meta">{updated}</p>
        <article className="lgd-body">{children}</article>
      </div>
    </main>
  );
}

const CSS = `
.lgd { background: var(--bg); min-height: var(--page-min-h); padding: clamp(28px, 5vh, 56px) var(--space-4) clamp(48px, 9vh, 96px); }
.lgd-inner { max-width: 760px; margin: 0 auto; }
.lgd-tabs { display: inline-flex; gap: 4px; margin-bottom: var(--space-6); padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.lgd-tab { padding: 7px 16px; border-radius: var(--radius-full); color: var(--text2); font-size: 0.9rem; font-weight: 700; text-decoration: none; transition: background 0.18s, color 0.18s; }
.lgd-tab:hover { color: var(--text); }
.lgd-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.lgd-title { margin: 0 0 var(--space-2); font-size: clamp(2rem, 4.4vw, 2.8rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
.lgd-meta { margin: 0 0 var(--space-6); padding-bottom: var(--space-5); border-bottom: 1px solid var(--border); font-size: 0.9rem; color: var(--text3); }
.lgd-body { font-size: 1rem; line-height: 1.75; color: var(--text2); }
.lgd-body h2 { margin: var(--space-8) 0 var(--space-3); font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text); }
.lgd-body h3 { margin: var(--space-5) 0 var(--space-2); font-size: 1rem; font-weight: 700; color: var(--text); }
.lgd-body p { margin: 0 0 var(--space-4); }
.lgd-body ul { margin: 0 0 var(--space-4); padding-left: 1.3rem; list-style: disc; }
.lgd-body li { margin-bottom: 6px; }
.lgd-body li::marker { color: var(--text3); }
.lgd-body strong { color: var(--text); font-weight: 700; }
.lgd-body a { color: var(--accent-text); text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 640px) { .lgd-body { font-size: 0.96rem; } }
`;
