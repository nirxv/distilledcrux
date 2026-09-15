import React from 'react';
import { Shell } from './Shell';
import { Badge } from '../uui/base/badges';
import { readTable } from './data';

/**
 * A boot check, not a dashboard. Each row says whether one thing the app
 * depends on is actually reachable and configured, so a misconfigured deploy
 * shows up here rather than as a 500 in front of a student.
 *
 * Only presence is reported. No secret value is ever read into the page.
 */
const REQUIRED_ENV = [
  ['DATABASE_URL', 'Postgres, for the CMS'],
  ['PAYLOAD_SECRET', 'Signs CMS sessions'],
  ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase project'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'Server-side Supabase'],
  ['FIREBASE_ADMIN_PRIVATE_KEY', 'Verifies user tokens'],
  ['RAZORPAY_KEY_SECRET', 'Verifies payment signatures'],
  ['GROQ_API_KEY', 'Evaluation model'],
  ['MISTRAL_API_KEY', 'Handwriting OCR'],
  ['VOYAGE_API_KEY', 'Book embeddings'],
] as const;

async function probe(table: string) {
  const { error } = await readTable<{ }>(table, '*', undefined, 1);
  return error;
}

export default async function OperationsView() {
  const tables = ['user_profiles', 'subscriptions', 'usage_tracking', 'user_sessions', 'note_overrides', 'rate_limits'];
  const probes = await Promise.all(tables.map(async t => ({ table: t, error: await probe(t) })));

  return (
    <Shell title="Operations">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-secondary bg-primary p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-tertiary">Configuration</h2>
          <p className="mt-1 text-sm text-tertiary">Whether the variable is set. Values are never read here.</p>
          <div className="mt-4 flex flex-col gap-2">
            {REQUIRED_ENV.map(([name, why]) => {
              const set = Boolean(process.env[name]);
              return (
                <div key={name} className="flex items-center justify-between gap-3 border-b border-secondary pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-primary">{name}</div>
                    <div className="truncate text-xs text-tertiary">{why}</div>
                  </div>
                  <Badge type="pill-color" size="sm" color={set ? 'success' : 'error'}>
                    {set ? 'Set' : 'Missing'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-secondary bg-primary p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-tertiary">Tables</h2>
          <p className="mt-1 text-sm text-tertiary">One row read from each, as the service client.</p>
          <div className="mt-4 flex flex-col gap-2">
            {probes.map(p => (
              <div key={p.table} className="flex items-center justify-between gap-3 border-b border-secondary pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-primary">{p.table}</div>
                  {p.error ? <div className="truncate text-xs text-error-primary">{p.error}</div> : null}
                </div>
                <Badge type="pill-color" size="sm" color={p.error ? 'error' : 'success'}>
                  {p.error ? 'Unreachable' : 'Reachable'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
