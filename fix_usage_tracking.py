with open('app/api/chat/route.ts', 'r') as f:
    src = f.read()

# Fix: replace the entire increment block
# Old: skips owner, uses .update() which fails if row doesn't exist
old = """          // Increment usage
          if (!isOwner && firebaseUid) {
            try {
              const { createClient: ccInc } = await import('@supabase/supabase-js');
              const sbInc = ccInc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
              const { data: existing } = await sbInc
                .from('usage_tracking')
                .select('chat_count')
                .eq('firebase_uid', firebaseUid)
                .single();
              const newCount = (existing?.chat_count ?? 0) + 1;
              await sbInc.from('usage_tracking')
                .update({ chat_count: newCount, updated_at: new Date().toISOString() })
                .eq('firebase_uid', firebaseUid);
              if (fingerprint) {
                await sbInc.from('usage_tracking')
                  .upsert({ fingerprint, firebase_uid: firebaseUid, chat_count: newCount }, { onConflict: 'fingerprint' });
              }
            } catch (incErr) {
              console.log('chat_count increment failed', incErr);
            }
          }"""

# New: always track (including owner), use upsert on firebase_uid
new = """          // Increment usage (track everyone including owner)
          if (firebaseUid) {
            try {
              const { createClient: ccInc } = await import('@supabase/supabase-js');
              const sbInc = ccInc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
              const { data: existing } = await sbInc
                .from('usage_tracking')
                .select('chat_count')
                .eq('firebase_uid', firebaseUid)
                .single();
              const newCount = (existing?.chat_count ?? 0) + 1;
              await sbInc.from('usage_tracking')
                .upsert(
                  { firebase_uid: firebaseUid, fingerprint: fingerprint ?? '', chat_count: newCount, updated_at: new Date().toISOString() },
                  { onConflict: 'firebase_uid' }
                );
            } catch (incErr) {
              console.log('chat_count increment failed', incErr);
            }
          }"""

if old in src:
    src = src.replace(old, new)
    with open('app/api/chat/route.ts', 'w') as f:
        f.write(src)
    print("✓ patched")
else:
    print("ERROR: old string not found, check manually")
