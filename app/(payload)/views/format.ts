/**
 * Client-safe formatting. Deliberately not in data.ts, which is `server-only`:
 * these are used on both sides of the RSC boundary, and a function cannot be
 * passed from a server component to a client one as a prop.
 */
export function relative(stamp?: string | null): string {
  if (!stamp) return '—';
  const t = Date.parse(stamp);
  if (Number.isNaN(t)) return '—';
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d` : `${Math.round(d / 30)}mo`;
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
