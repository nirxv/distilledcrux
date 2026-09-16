import React from 'react';
import { cmsView } from './guard';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { Badge } from '../uui/base/badges';
import { readTable, relative, truncate, since, SUBJECT_LABEL, normaliseSubject } from './data';

type Profile = {
  firebase_uid: string;
  email: string | null;
  optional: string | null;
  phone: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Sub = { firebase_uid: string; status: string | null; expires_at: string | null };

/**
 * Everyone who has signed up. The Overview's "registered users" tile points
 * here, since the number on its own does not say who they are or which
 * optional they picked.
 *
 * Phone is shown because it was only made mandatory recently: profiles created
 * before that have none, and they are asked for one on their next visit, so
 * this column is how that backfill is watched.
 */
export default cmsView(async function UsersView() {
  const [profiles, subs] = await Promise.all([
    readTable<Profile>('user_profiles', '*', { column: 'created_at' }, 2000),
    readTable<Sub>('subscriptions', 'firebase_uid, status, expires_at', undefined, 2000),
  ]);

  const now = Date.now();
  const paying = new Set(
    subs.rows
      .filter(s => s.status === 'active' && s.expires_at && Date.parse(s.expires_at) > now)
      .map(s => s.firebase_uid),
  );

  const withPhone = profiles.rows.filter(p => p.phone).length;

  return (
    <Shell title="Users" count={`${profiles.rows.length} registered`} error={profiles.error}>
      <Stats items={[
        { label: 'Registered', value: profiles.rows.length },
        { label: 'Joined last 7 days', value: since(profiles.rows, 7 * 86_400_000) },
        { label: 'Paying', value: paying.size, href: '/cms/subscribers' },
        { label: 'Gave a number', value: `${withPhone}/${profiles.rows.length}` },
      ]} />

      <TableFrame
        min={880}
        empty={profiles.rows.length === 0}
        head={[
          { label: 'User' }, { label: 'Optional' }, { label: 'Mobile' },
          { label: 'Joined', align: 'right' }, { label: 'Plan', align: 'right' },
        ]}
      >
        {profiles.rows.map((p, i) => (
          <Row key={p.firebase_uid ?? i}>
            <Cell strong>{p.email || truncate(p.firebase_uid, 28)}</Cell>
            <Cell dim>{SUBJECT_LABEL[normaliseSubject(p.optional)] ?? p.optional ?? '—'}</Cell>
            <Cell mono>
              {p.phone
                ? p.phone
                : <Badge type="pill-color" size="sm" color="warning">Not given</Badge>}
            </Cell>
            <Cell align="right" dim>{relative(p.created_at)}</Cell>
            <Cell align="right">
              {paying.has(p.firebase_uid)
                ? <Badge type="pill-color" size="sm" color="success">Paid</Badge>
                : <Badge type="pill-color" size="sm" color="gray">Free</Badge>}
            </Cell>
          </Row>
        ))}
      </TableFrame>
    </Shell>
  );
});
