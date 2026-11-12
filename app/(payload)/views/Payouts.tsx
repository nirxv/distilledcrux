import React from 'react';
import { cmsView } from './guard';
import { Shell, Stats, TableFrame, Row, Cell } from './Shell';
import { Badge } from '../uui/base/badges';
import { readTable, relative } from './data';
import { settlePayout } from './payoutActions';

type Payout = {
  id: string;
  firebase_uid: string;
  email: string;
  amount_paise: number;
  upi_id: string;
  milestone_paise: number;
  status: 'requested' | 'paid' | 'cancelled';
  requested_at: string;
  settled_at: string | null;
  note: string | null;
};

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/**
 * Invite cash-outs. A reader asks for their balance at a milestone and the
 * money leaves their balance at once (migration 012). Pay it from a UPI app to
 * the id shown, check the name the app shows first, then mark it paid here.
 * Cancel puts the money back in their balance.
 */
export default cmsView(async function PayoutsView() {
  const [payouts, ledger] = await Promise.all([
    readTable<Payout>('referral_payouts', '*', { column: 'requested_at' }, 1000),
    readTable<{ amount_paise: number }>('referral_ledger', 'amount_paise', undefined, 20000),
  ]);
  const rows = payouts.rows;
  const waiting = rows.filter((r) => r.status === 'requested').sort((a, b) => a.requested_at.localeCompare(b.requested_at));
  const settled = rows.filter((r) => r.status !== 'requested');
  const paidTotal = settled.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount_paise, 0);
  const owed = ledger.rows.reduce((s, r) => s + r.amount_paise, 0);

  return (
    <Shell title="Payouts" count={`${waiting.length} waiting`} error={payouts.error ?? ledger.error}>
      <Stats items={[
        { label: 'Waiting', value: rupees(waiting.reduce((s, r) => s + r.amount_paise, 0)) },
        { label: 'Paid out', value: rupees(paidTotal) },
        { label: 'Balances held', value: rupees(owed) },
      ]} />

      <h2 className="mt-6 text-xs font-medium uppercase tracking-wide text-tertiary">Waiting, oldest first</h2>
      <p className="mt-1 text-sm text-tertiary">Send the amount to the UPI id from your own app, check the name it shows, then mark it paid.</p>
      <div className="mt-3">
        <TableFrame empty={waiting.length === 0} min={900} head={[
          { label: 'Reader' }, { label: 'UPI id' }, { label: 'Amount', align: 'right' }, { label: 'Milestone', align: 'right' }, { label: 'Asked' }, { label: 'Settle' },
        ]}>
          {waiting.map((r) => (
            <Row key={r.id}>
              <Cell strong>{r.email || r.firebase_uid}</Cell>
              <Cell mono>{r.upi_id}</Cell>
              <Cell align="right" strong>{rupees(r.amount_paise)}</Cell>
              <Cell align="right" dim>{rupees(r.milestone_paise)}</Cell>
              <Cell dim>{relative(r.requested_at)}</Cell>
              <Cell>
                <form action={settlePayout} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="UPI reference" className="w-40 rounded-md border border-primary bg-primary px-2 py-1 text-sm" />
                  <button type="submit" name="status" value="paid" className="rounded-md bg-brand-solid px-3 py-1 text-sm font-semibold text-white">Mark paid</button>
                  <button type="submit" name="status" value="cancelled" className="rounded-md border border-primary px-3 py-1 text-sm text-secondary">Cancel</button>
                </form>
              </Cell>
            </Row>
          ))}
        </TableFrame>
      </div>

      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-tertiary">Settled</h2>
      <div className="mt-3">
        <TableFrame empty={settled.length === 0} head={[
          { label: 'Reader' }, { label: 'UPI id' }, { label: 'Amount', align: 'right' }, { label: 'State' }, { label: 'When' }, { label: 'Note' },
        ]}>
          {settled.map((r) => (
            <Row key={r.id}>
              <Cell>{r.email || r.firebase_uid}</Cell>
              <Cell mono dim>{r.upi_id}</Cell>
              <Cell align="right">{rupees(r.amount_paise)}</Cell>
              <Cell>
                <Badge type="pill-color" size="sm" color={r.status === 'paid' ? 'success' : 'gray'}>{r.status === 'paid' ? 'Paid' : 'Cancelled'}</Badge>
              </Cell>
              <Cell dim>{r.settled_at ? relative(r.settled_at) : ''}</Cell>
              <Cell dim wrap>{r.note ?? ''}</Cell>
            </Row>
          ))}
        </TableFrame>
      </div>
    </Shell>
  );
});
