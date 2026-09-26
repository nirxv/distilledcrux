'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

/**
 * The site footer, rendered once by the frontend layout so every route
 * carries it. It used to be pasted into the landing, notes and prelims
 * pages, which is why prelims had drifted into a second wordmark and a
 * different copyright line.
 *
 * It also publishes its own height as --footer-h. Pages that size a shell to
 * the viewport, the chat being the one that does, have to subtract the footer
 * or they overflow and drag the whole app up as the reader scrolls to reach
 * it. Measuring beats a hard-coded number because the footer stacks into a
 * column on a phone.
 */
export default function Footer() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty('--footer-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <footer className="lp-footer" ref={ref}>
      <style>{`
        /* Height matches the navbar's 60px so the two bars frame the page
           evenly; both include their 1px border under the global border-box. */
        .lp-footer {
          border-top: 1px solid var(--border);
          height: 60px; padding: 0 2.25rem;
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; gap: 1rem;
        }
        .lp-footer-end { display: flex; justify-content: flex-end; }
        .lp-footer-logo { font-family: var(--font-monument, 'Neue Haas Grotesk', system-ui); font-size: 0.78rem; font-weight: 900; color: var(--text); letter-spacing: 0.06em; }
        .lp-footer-links { display: flex; justify-content: center; gap: 1.75rem; flex-wrap: wrap; }
        .lp-footer-logo { justify-self: start; }
        .lp-footer-link { font-family: var(--font-ui); font-size: 0.78rem; font-weight: 500; color: var(--text3); text-decoration: none; transition: color 0.15s; }
        .lp-footer-link:hover { color: var(--text); }
        /* Telegram, as on the history platform, but in this site's accent
           rather than its --info-* tokens, which do not exist here. */
        .lp-footer-tg {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 8px;
          background: var(--accent-dim);
          border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          color: var(--accent); text-decoration: none;
          font-family: var(--font-ui); font-size: 0.69rem; font-weight: 600;
          letter-spacing: 0.03em; transition: background 0.18s, border-color 0.18s;
        }
        .lp-footer-tg:hover {
          background: color-mix(in srgb, var(--accent) 18%, transparent);
          border-color: color-mix(in srgb, var(--accent) 60%, transparent);
        }
        @media (max-width: 900px) {
          .lp-footer { grid-template-columns: 1fr; justify-items: center; text-align: center; height: auto; padding: 1.5rem 1.25rem; gap: 0.85rem; }
          .lp-footer-end { justify-content: center; }
          .lp-footer-links { justify-content: center; gap: 1.25rem; }
          .lp-footer-link { font-size: 0.75rem; font-weight: 500; }
          .lp-footer-logo { font-size: 0.72rem; font-weight: 500; }
        }
      `}</style>
      <div className="lp-footer-logo">DISTILLEDCRUX.COM</div>

      <div className="lp-footer-links">
        <Link href="/privacy" className="lp-footer-link">Privacy</Link>
        <Link href="/terms" className="lp-footer-link">Terms</Link>
        <Link href="/refund" className="lp-footer-link">Refund</Link>
        <Link href="/contact" className="lp-footer-link">Contact</Link>
      </div>

      <div className="lp-footer-end">
        <a
          className="lp-footer-tg"
          href="https://t.me/distilledcrux"
          target="_blank"
          rel="noopener noreferrer"
          title="Join Telegram"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
          </svg>
          Join Telegram
        </a>
      </div>
    </footer>
  );
}
