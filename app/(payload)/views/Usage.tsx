import React from 'react';
import { cmsView } from './guard';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { readTable, relative, truncate } from './data';

/**
 * usage_tracking counts per identity rather than per user: a signed-in row is
 * keyed by firebase_uid, and an anonymous one by the hashed fingerprint that
 * lib/usageIdentity derives, so the free tier cannot be reset by signing out.
 */
type Usage = {
  id?: string | number;
  firebase_uid?: string | null;
  fingerprint?: string | null;
  chat_count?: number | null;
  eval_count?: number | null;
  updated_at?: string | null;
};

export default cmsView(async function UsageView() {
  const { rows, error } = await readTable<Usage>(
    'usage_tracking', '*', { column: 'updated_at' }, 2000);

  const chats = rows.reduce((n, r) => n + (r.chat_count ?? 0), 0);
  const evals = rows.reduce((n, r) => n + (r.eval_count ?? 0), 0);
  const signedIn = rows.filter(r => r.firebase_uid);

  return (
    <Shell title="Usage" count={`${rows.length} identities tracked`} error={error}>
      <Stats items={[
        { label: 'Chat messages', value: chats },
        { label: 'Evaluations', value: evals },
        { label: 'Signed in', value: signedIn.length },
        { label: 'Anonymous', value: rows.length - signedIn.length },
      ]} />

      <TableFrame
        min={720}
        empty={rows.length === 0}
        head={[
          { label: 'Identity' }, { label: 'Kind' },
          { label: 'Chats', align: 'right' }, { label: 'Evaluations', align: 'right' },
          { label: 'Last used', align: 'right' },
        ]}
      >
        {rows.map((r, i) => (
          <Row key={r.id ?? i}>
            <Cell strong>{truncate(r.firebase_uid ?? r.fingerprint, 42)}</Cell>
            <Cell dim>{r.firebase_uid ? 'Signed in' : 'Anonymous'}</Cell>
            <Cell align="right" mono>{r.chat_count ?? 0}</Cell>
            <Cell align="right" mono>{r.eval_count ?? 0}</Cell>
            <Cell align="right" dim>{relative(r.updated_at)}</Cell>
          </Row>
        ))}
      </TableFrame>
    </Shell>
  );
});
