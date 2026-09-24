'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Scratch notes for one note page, kept in this browser only.
 *
 * Deliberately localStorage rather than the database: these are a reader's own
 * margin scribbles, they are worth nothing to anyone else, and storing them
 * server-side would mean a table and a sync story for something that is useful
 * the moment it is typed. The trade is that they do not follow the reader to
 * another device, which the UI says rather than leaving it to be discovered.
 *
 * Keyed by subject and slug, so each note page has its own set.
 */
export type ScratchNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

const keyFor = (subject: string, slug: string) => `dc_scratch_notes_${subject}_${slug}`;

function load(subject: string, slug: string): ScratchNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(subject, slug)) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (n): n is ScratchNote => n && typeof n.id === 'string' && typeof n.body === 'string',
    );
  } catch {
    return [];
  }
}

function save(subject: string, slug: string, notes: ScratchNote[]) {
  try {
    localStorage.setItem(keyFor(subject, slug), JSON.stringify(notes));
  } catch {
    // Private browsing, or the quota is full. The notes stay usable for this
    // session; there is nothing honest to promise beyond that.
  }
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function SidebarNotes({ subject, slug }: { subject: string; slug: string }) {
  const [notes, setNotes] = useState<ScratchNote[]>([]);
  const [mounted, setMounted] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const justAdded = useRef<string | null>(null);

  // localStorage is not available during the server render, so the list is
  // empty on the first paint and fills in here. Without the mounted flag the
  // markup would differ between server and client and hydration would warn.
  useEffect(() => {
    setNotes(load(subject, slug));
    setMounted(true);
  }, [subject, slug]);

  const commit = useCallback(
    (next: ScratchNote[]) => {
      setNotes(next);
      save(subject, slug, next);
    },
    [subject, slug],
  );

  const add = () => {
    const note: ScratchNote = { id: newId(), title: '', body: '', updatedAt: Date.now() };
    justAdded.current = note.id;
    setCollapsed(false);
    commit([note, ...notes]);
  };

  const update = (id: string, patch: Partial<ScratchNote>) =>
    commit(notes.map(n => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));

  const remove = (id: string) => {
    setConfirmingId(null);
    commit(notes.filter(n => n.id !== id));
  };

  if (!mounted) return null;

  return (
    <section className="sb-notes" aria-label="My notes">
      <button
        type="button"
        className="sb-section-label"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span>My notes{notes.length > 0 ? ` (${notes.length})` : ''}</span>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          style={{ transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
          <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!collapsed && (
        <div className="sb-notes-body">
          <button type="button" onClick={add} className="sb-note-add">+ Add a note</button>

          {notes.map(n => (
            <div key={n.id} className="sb-note">
              <input
                className="sb-note-title"
                value={n.title}
                placeholder="Title (optional)"
                onChange={e => update(n.id, { title: e.target.value })}
                aria-label="Note title"
                // A note added by the button should be ready to type into.
                autoFocus={justAdded.current === n.id}
              />
              <textarea
                className="sb-note-body"
                value={n.body}
                rows={3}
                placeholder="Write here…"
                onChange={e => update(n.id, { body: e.target.value })}
                aria-label="Note"
              />
              <div className="sb-note-foot">
                <span>{new Date(n.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                {confirmingId === n.id ? (
                  <span className="sb-note-confirm">
                    <button type="button" onClick={() => remove(n.id)}>Delete</button>
                    <button type="button" onClick={() => setConfirmingId(null)}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmingId(n.id)} aria-label="Delete note">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {notes.length > 0 && <p className="sb-note-scope">Saved on this device</p>}
        </div>
      )}
    </section>
  );
}
