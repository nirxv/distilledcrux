import React from 'react';
import { Gutter } from '@payloadcms/ui';
import '../uui/theme.css';

/**
 * The frame every operational view shares.
 *
 * Gutter is Payload's, so these screens line up with its own pages. Everything
 * inside is Untitled UI on isolated Tailwind, hence the .uui wrapper: that is
 * the only place our utilities apply, because preflight is never imported.
 */
export function Shell({ title, count, error, children }: {
  title: string;
  count?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Gutter>
      <div className="uui">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
          {count !== undefined && !error
            ? <span className="text-sm text-tertiary">{count}</span>
            : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-error_subtle bg-error-primary px-4 py-3 text-sm text-error-primary">
            Could not load: {error}
          </div>
        ) : (
          <div className="mt-5">{children}</div>
        )}
      </div>
    </Gutter>
  );
}

/** Read-only stat tiles, for views with nothing to filter by. */
export function Stats({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(i => (
        <div key={i.label} className="rounded-xl border border-secondary bg-primary px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-tertiary">{i.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-primary">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

/** A table that scrolls itself on a phone rather than pushing the page sideways. */
export function TableFrame({ head, children, empty, min = 640 }: {
  head: { label: string; align?: 'right' }[];
  children: React.ReactNode;
  empty?: boolean;
  min?: number;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-secondary">
      <table className="w-full" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-secondary bg-secondary">
            {head.map(h => (
              <th
                key={h.label}
                className={`px-4 py-3 text-xs font-medium text-tertiary ${h.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-8 text-center text-sm text-tertiary">Nothing here yet.</p> : null}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-secondary last:border-0 hover:bg-secondary">{children}</tr>;
}

export function Cell({ children, align, mono, dim, strong, wrap }: {
  children: React.ReactNode;
  align?: 'right';
  mono?: boolean;
  dim?: boolean;
  strong?: boolean;
  wrap?: boolean;
}) {
  return (
    <td className={[
      'px-4 py-3 text-sm',
      align === 'right' ? 'text-right' : 'text-left',
      mono ? 'tabular-nums' : '',
      strong ? 'font-medium text-primary' : dim ? 'text-tertiary' : 'text-secondary',
      wrap ? '' : 'whitespace-nowrap',
    ].join(' ')}>
      {children}
    </td>
  );
}
