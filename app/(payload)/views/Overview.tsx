import React from 'react';
import { cmsView } from './guard';
import { NOTE_SUBJECTS, notesForSubject } from '@/lib/notes';
import { Shell, Stats } from './Shell';
import { readTable, since, SUBJECT_LABEL, normaliseSubject } from './data';

type Profile = { firebase_uid: string; email: string | null; optional: string | null; created_at?: string | null };
type Sub = { firebase_uid: string; optional: string | null; plan: string | null; status: string | null; expires_at: string | null };
type Usage = { chat_count?: number | null; eval_count?: number | null; updated_at?: string | null };
type Session = { session_start?: string | null; last_active?: string | null };
type Override = { slug: string; content: string | null };

function Bars({ title, rows }: {
  title: string;
  rows: { label: string; value: number; max: number; caption: string }[];
}) {
  return (
    <div className="rounded-xl border border-secondary bg-primary p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-tertiary">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr_3.5rem] sm:items-center sm:gap-3">
            <span className="text-sm text-secondary">{r.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-brand-solid"
                style={{ width: `${Math.min(100, (r.value / Math.max(1, r.max)) * 100)}%` }}
              />
            </span>
            <span className="text-sm tabular-nums text-tertiary sm:text-right">{r.caption}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Content and account activity from the app's own records, not page traffic. */
export default cmsView(async function OverviewView() {
  const [profiles, subs, usage, sessions, overrides] = await Promise.all([
    readTable<Profile>('user_profiles', 'firebase_uid, email, optional, created_at', undefined, 2000),
    readTable<Sub>('subscriptions', 'firebase_uid, optional, plan, status, expires_at', undefined, 2000),
    readTable<Usage>('usage_tracking', 'chat_count, eval_count, updated_at', undefined, 2000),
    readTable<Session>('user_sessions', 'session_start, last_active', { column: 'session_start' }, 2000),
    readTable<Override>('note_overrides', 'slug, content', undefined, 1000),
  ]);

  const now = Date.now();
  const active = subs.rows.filter(
    s => s.status === 'active' && s.expires_at && Date.parse(s.expires_at) > now);

  const chats = usage.rows.reduce((n, u) => n + (u.chat_count ?? 0), 0);
  const evals = usage.rows.reduce((n, u) => n + (u.eval_count ?? 0), 0);

  const edited = new Set(overrides.rows.map(o => o.slug));
  const bySubject = NOTE_SUBJECTS.map(subject => {
    const items = notesForSubject(subject);
    return {
      subject,
      total: items.length,
      edited: items.filter(n => edited.has(n.slug)).length,
      signups: profiles.rows.filter(p => normaliseSubject(p.optional) === subject).length,
      paying: active.filter(s => normaliseSubject(s.optional) === subject).length,
    };
  });
  const maxSignups = Math.max(1, ...bySubject.map(s => s.signups));

  return (
    <Shell title="Overview" count="from the app's own records, not page traffic" error={profiles.error}>
      <Stats items={[
        { label: 'Registered users', value: profiles.error ? '—' : profiles.rows.length },
        { label: 'Active subscriptions', value: subs.error ? '—' : active.length },
        { label: 'Chat messages', value: usage.error ? '—' : chats },
        { label: 'Evaluations', value: usage.error ? '—' : evals },
        { label: 'Sessions', value: sessions.error ? '—' : sessions.rows.length },
        { label: 'Active last 24h', value: sessions.error ? '—' : since(sessions.rows, 86_400_000, 'last_active') },
        { label: 'Syllabus topics', value: bySubject.reduce((n, s) => n + s.total, 0) },
        { label: 'Edited in CMS', value: overrides.error ? '—' : edited.size },
      ]} />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bars
          title="Users, by optional"
          rows={bySubject.map(s => ({
            label: SUBJECT_LABEL[s.subject] ?? s.subject,
            value: s.signups,
            max: maxSignups,
            caption: `${s.signups}`,
          }))}
        />
        <Bars
          title="Paying, by optional"
          rows={bySubject.map(s => ({
            label: SUBJECT_LABEL[s.subject] ?? s.subject,
            value: s.paying,
            max: Math.max(1, s.signups),
            caption: `${s.paying}/${s.signups}`,
          }))}
        />
        <Bars
          title="Topics edited, by subject"
          rows={bySubject.map(s => ({
            label: SUBJECT_LABEL[s.subject] ?? s.subject,
            value: s.edited,
            max: s.total,
            caption: `${s.edited}/${s.total}`,
          }))}
        />
        <Bars
          title="Syllabus size, by subject"
          rows={bySubject.map(s => ({
            label: SUBJECT_LABEL[s.subject] ?? s.subject,
            value: s.total,
            max: Math.max(1, ...bySubject.map(x => x.total)),
            caption: `${s.total}`,
          }))}
        />
      </div>
    </Shell>
  );
});
