import type { SupabaseClient } from '@supabase/supabase-js';
import { newRefCode } from '@/lib/referral';

/**
 * The reader's invite code, made the first time they ask for it. A clash on
 * the random code is retried; a clash on the uid means a parallel request made
 * one first, so that one is read back.
 */
export async function getOrCreateRefCode(db: SupabaseClient, uid: string): Promise<string | null> {
  const { data: existing } = await db.from('referral_codes').select('code').eq('firebase_uid', uid).maybeSingle();
  if (existing?.code) return existing.code;

  for (let i = 0; i < 4; i++) {
    const code = newRefCode();
    const { error } = await db.from('referral_codes').insert({ code, firebase_uid: uid });
    if (!error) return code;
    if (error.code !== '23505') {
      console.error('[referral] code insert failed:', error.message);
      return null;
    }
    const { data: raced } = await db.from('referral_codes').select('code').eq('firebase_uid', uid).maybeSingle();
    if (raced?.code) return raced.code;
  }
  return null;
}
