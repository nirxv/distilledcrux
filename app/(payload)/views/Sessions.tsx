import React from 'react';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { readTable, relative, truncate, since } from './data';

type Session = {
  id?: string | number;
  visitor_id?: string | null;
  visit_count?: number | null;
  pages_visited?: string[] | null;
  session_start?: string | null;
  last_active?: string | null;
  duration_seconds?: number | null;
};

export default async function SessionsView() {
  const { rows, error } = await readTable<Session>(
    'user_sessions', '*', { column: 'session_start' }, 1000);

  const durations = rows
    .map(r => r.duration_seconds)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const median = durations.length
    ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)]
    : null;

  // A page counted once per session, so this is reach rather than page views.
  const pageHits = new Map<string, number>();
  for (const r of rows) {
    for (const p of r.pages_visited ?? []) pageHits.set(p, (pageHits.get(p) ?? 0) + 1);
  }
  const topPages = [...pageHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <Shell title="Sessions" count={`${rows.length} most recent`} error={error}>
      <Stats items={[
        { label: 'Sessions', value: rows.length },
        { label: 'Started last 24h', value: since(rows, 86_400_000, 'session_start') },
        { label: 'Distinct visitors', value: new Set(rows.map(r => r.visitor_id)).size },
        { label: 'Median length', value: median ? `${Math.round(median / 60)}m` : '—' },
      ]} />

      {topPages.length > 0 && (
        <div className="mt-5 rounded-xl border border-secondary bg-primary p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-tertiary">
            Most visited pages
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {topPages.map(([page, n]) => (
              <div key={page} className="grid grid-cols-1 gap-1 sm:grid-cols-[16rem_1fr_3rem] sm:items-center sm:gap-3">
                <span className="truncate text-sm text-secondary" title={page}>{page}</span>
                <span className="h-2 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-brand-solid"
                    style={{ width: `${Math.min(100, (n / topPages[0][1]) * 100)}%` }}
                  />
                </span>
                <span className="text-sm tabular-nums text-tertiary sm:text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TableFrame
        min={760}
        empty={rows.length === 0}
        head={[
          { label: 'Visitor' }, { label: 'Started' },
          { label: 'Visits', align: 'right' }, { label: 'Pages', align: 'right' },
          { label: 'Length', align: 'right' }, { label: 'Last active', align: 'right' },
        ]}
      >
        {rows.map((r, i) => (
          <Row key={r.id ?? i}>
            <Cell strong>{truncate(r.visitor_id, 34)}</Cell>
            <Cell dim>{relative(r.session_start)}</Cell>
            <Cell align="right" mono>{r.visit_count ?? 1}</Cell>
            <Cell align="right" mono dim>{r.pages_visited?.length ?? 0}</Cell>
            <Cell align="right" mono dim>
              {r.duration_seconds ? `${Math.round(r.duration_seconds / 60)}m` : '—'}
            </Cell>
            <Cell align="right" dim>{relative(r.last_active)}</Cell>
          </Row>
        ))}
      </TableFrame>
    </Shell>
  );
}
