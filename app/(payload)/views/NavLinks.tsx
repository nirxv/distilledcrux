'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './nav.css';

/**
 * Rendered after Payload's own collection links. These screens read tables the
 * app owns rather than Payload collections, so they are views rather than
 * collections and need their own entries in the sidebar.
 */
const LINKS = [
  ['/cms/overview', 'Overview'],
  ['/cms/subscribers', 'Subscribers'],
  ['/cms/usage', 'Usage'],
  ['/cms/sessions', 'Sessions'],
  ['/cms/content', 'Content'],
  ['/cms/operations', 'Operations'],
] as const;

export default function OpsNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="ops-nav" aria-label="Operations">
      <div className="ops-nav-label">Operations</div>
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`nav__link${pathname === href ? ' active' : ''}`}
          aria-current={pathname === href ? 'page' : undefined}
        >
          <span className="nav__link-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
