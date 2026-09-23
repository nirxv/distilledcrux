import Link from 'next/link';

/**
 * Placeholder for a route that is linked from the site but not built yet.
 *
 * The subject landing page links to /{subject}/pyqs for every optional,
 * including the ones whose question bank has not been added, so the link
 * returned Next's default 404. A 404 tells a paying reader the page is
 * broken; this tells them it is coming and gives them somewhere to go.
 */
export default function ComingSoon({
  title,
  body,
  backHref,
  backLabel,
}: {
  title: string;
  body: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 2rem 96px',
    }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          marginBottom: '1rem',
        }}>
          Coming soon
        </div>

        <h1 style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1.6rem',
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.3,
          margin: '0 0 0.85rem',
        }}>
          {title}
        </h1>

        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'var(--text2)',
          lineHeight: 1.7,
          margin: '0 0 1.75rem',
        }}>
          {body}
        </p>

        <Link
          href={backHref}
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.6rem 1.15rem',
            textDecoration: 'none',
          }}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
