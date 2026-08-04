with open('app/api/evaluate/route.ts', 'r') as f:
    src = f.read()

old = """    // Increment eval_count for all users (except owner) after successful evaluation
    if (!isOwner && token) {
      try {
        const { verifyFirebaseToken: vftInc } = await import("@/lib/verifyFirebaseToken");
        const userInc = await vftInc(token);
        if (userInc) {
          const { createClient: createClientInc } = await import("@supabase/supabase-js");
          const supabaseInc = createClientInc(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
          );
          const { data: existingUsage } = await supabaseInc
            .from("usage_tracking")
            .select("eval_count")
            .eq("firebase_uid", userInc.uid)
            .single();
          const newCount = (existingUsage?.eval_count ?? 0) + 1;
          await supabaseInc
            .from("usage_tracking")
            .update({ eval_count: newCount, updated_at: new Date().toISOString() }).eq("firebase_uid", userInc.uid);
          // Also update FP row so device-based abuse is blocked on new accounts
          if (fingerprint) {
            await supabaseInc
              .from("usage_tracking")
              .upsert({ fingerprint, eval_count: newCount }, { onConflict: "fingerprint" });
          }
        }
      } catch (incErr) {
        console.log("eval_count increment failed", incErr);
      }
    }"""

new = """    // Increment eval_count for all users after successful evaluation
    if (token) {
      try {
        const { verifyFirebaseToken: vftInc } = await import("@/lib/verifyFirebaseToken");
        const userInc = await vftInc(token);
        if (userInc) {
          const { createClient: createClientInc } = await import("@supabase/supabase-js");
          const supabaseInc = createClientInc(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
          );
          const { data: existingUsage } = await supabaseInc
            .from("usage_tracking")
            .select("eval_count")
            .eq("firebase_uid", userInc.uid)
            .single();
          const newCount = (existingUsage?.eval_count ?? 0) + 1;
          await supabaseInc
            .from("usage_tracking")
            .upsert(
              { firebase_uid: userInc.uid, fingerprint: fingerprint ?? '', eval_count: newCount, updated_at: new Date().toISOString() },
              { onConflict: "firebase_uid" }
            );
        }
      } catch (incErr) {
        console.log("eval_count increment failed", incErr);
      }
    }"""

if old in src:
    src = src.replace(old, new)
    with open('app/api/evaluate/route.ts', 'w') as f:
        f.write(src)
    print("✓ patched")
else:
    print("ERROR: string not found")
