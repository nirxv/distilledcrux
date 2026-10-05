'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
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
    <footer className="ds-footer ds" ref={ref}>
      <style>{FOOTER_CSS}</style>
      <div className="ds-footer-inner">
        <Link href="/" className="ds-footer-brand">
          <Image src="/mascot/owl.svg" alt="" width={26} height={25} />
          <span>Distilled Crux</span>
        </Link>

        <nav className="ds-footer-links" aria-label="Footer">
          <Link href="/#optionals">Optionals</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund</Link>
        </nav>

        <div className="ds-footer-end">
          <a className="ds-footer-tg" href="https://t.me/distilledcrux" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
            </svg>
            Telegram
          </a>
        </div>
      </div>
    </footer>
  );
}

const FOOTER_CSS = `
.ds-footer { border-top: 1px solid var(--border); background: var(--bg); }
.ds-footer-inner {
  max-width: 1200px; margin: 0 auto; padding: var(--space-5) var(--space-6);
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--space-4);
}
.ds-footer-brand { display: inline-flex; align-items: center; gap: var(--space-2); justify-self: start; color: var(--text); text-decoration: none; font-weight: 700; font-size: 0.95rem; }
.ds-footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1) var(--space-5); }
.ds-footer-links a { color: var(--text2); text-decoration: none; font-size: 0.88rem; transition: color 0.15s; }
.ds-footer-links a:hover { color: var(--accent-text); }
.ds-footer-end { justify-self: end; }
.ds-footer-tg {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 var(--space-3);
  border: 1px solid var(--border2); border-radius: var(--radius-md); background: var(--ds-card);
  color: var(--text2); text-decoration: none; font-size: 0.86rem; transition: border-color 0.15s, color 0.15s;
}
.ds-footer-tg:hover { border-color: color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent-text); }
@media (max-width: 860px) {
  .ds-footer-inner { grid-template-columns: 1fr; justify-items: center; text-align: center; padding: var(--space-6) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom, 0px)); }
  .ds-footer-brand, .ds-footer-end { justify-self: center; }
  .ds-footer-links { gap: var(--space-2) var(--space-4); }
}
`;
