import React from 'react';
import { cmsView } from './guard';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { Badge } from '../uui/base/badges';
import { readTable, relative, SUBJECT_LABEL, normaliseSubject } from './data';

type Sub = {
  id?: string | number;
  firebase_uid: string;
  email: string | null;
  plan: string | null;
  optional: string | null;
  status: string | null;
  expires_at: string | null;
  razorpay_payment_id?: string | null;
  updated_at?: string | null;
};

/** Inside this window a subscription is close enough to renewal to flag. */
const SOON_MS = 7 * 86_400_000;

function state(s: Sub, now: number) {
  const exp = s.expires_at ? Date.parse(s.expires_at) : NaN;
  if (s.status !== 'active') return { label: s.status ?? 'unknown', color: 'gray' as const };
  if (Number.isNaN(exp)) return { label: 'No expiry', color: 'warning' as const };
  if (exp <= now) return { label: 'Expired', color: 'error' as const };
  if (exp - now < SOON_MS) return { label: 'Expiring', color: 'warning' as const };
  return { label: 'Active', color: 'success' as const };
}

export default cmsView(async function SubscribersView() {
  const { rows, error } = await readTable<Sub>(
    'subscriptions', '*', { column: 'updated_at' }, 2000);

  const now = Date.now();
  const marked = rows.map(r => ({ row: r, ...state(r, now) }));
  const active = marked.filter(m => m.label === 'Active' || m.label === 'Expiring');

  return (
    <Shell title="Subscribers" count={`${rows.length} on record`} error={error}>
      <Stats items={[
        { label: 'Active', value: active.length },
        { label: 'Expiring in 7 days', value: marked.filter(m => m.label === 'Expiring').length },
        { label: 'Expired', value: marked.filter(m => m.label === 'Expired').length },
        { label: 'Distinct users', value: new Set(rows.map(r => r.firebase_uid)).size },
      ]} />

      <TableFrame
        min={860}
        empty={rows.length === 0}
        head={[
          { label: 'User' }, { label: 'Optional' }, { label: 'Plan' },
          { label: 'Expires' }, { label: 'Updated', align: 'right' }, { label: 'State', align: 'right' },
        ]}
      >
        {marked.map((m, i) => (
          <Row key={m.row.id ?? `${m.row.firebase_uid}-${i}`}>
            <Cell strong>{m.row.email || m.row.firebase_uid}</Cell>
            <Cell>{SUBJECT_LABEL[normaliseSubject(m.row.optional)] ?? m.row.optional ?? '—'}</Cell>
            <Cell dim>{m.row.plan ?? '—'}</Cell>
            <Cell mono dim>
              {m.row.expires_at
                ? new Date(m.row.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </Cell>
            <Cell align="right" dim>{relative(m.row.updated_at)}</Cell>
            <Cell align="right">
              <Badge type="pill-color" size="sm" color={m.color}>{m.label}</Badge>
            </Cell>
          </Row>
        ))}
      </TableFrame>
    </Shell>
  );
});
