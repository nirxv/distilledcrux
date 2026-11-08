import { cache } from 'react';
import { createServerClient } from '@/lib/supabase';
import type { ShareCard } from '@/lib/shareCard';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** A published card, or null. The card was checked and stored by /api/share. */
export const loadSharedCheck = cache(async (shareId: string): Promise<(ShareCard & { date: string }) | null> => {
  if (!ID_RE.test(shareId)) return null;
  const { data } = await createServerClient()
    .from('shared_checks')
    .select('card, created_at')
    .eq('share_id', shareId)
    .maybeSingle();
  return data ? { ...(data.card as ShareCard), date: data.created_at } : null;
});
