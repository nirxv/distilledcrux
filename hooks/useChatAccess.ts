'use client';
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type ChatAccess = {
  /** True until sign-in has settled and the usage has been read. */
  loading: boolean;
  signedIn: boolean;
  /** Subscribed to the optional the chat is in, not to any optional. */
  subscribed: boolean;
  used: number;
  limit: number;
};

const LOADING: ChatAccess = { loading: true, signedIn: false, subscribed: false, used: 0, limit: 3 };

/**
 * Who is chatting and what they may do, for one optional: signed in or not,
 * subscribed or not, and how many of the free messages are gone. The chat
 * page draws its gates and the "Free messages remaining" line from this;
 * /api/chat enforces the same rules whatever the page believes.
 *
 * `user` is undefined until Firebase has decided, and null when signed out.
 */
export function useChatAccess(subject: string) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [access, setAccess] = useState<ChatAccess>(LOADING);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (user === undefined) return;
    let live = true;
    (async () => {
      try {
        const token = user ? await user.getIdToken() : '';
        const res = await fetch(`/api/chat/usage?subject=${encodeURIComponent(subject)}`, {
          headers: token ? { 'x-user-token': token } : {},
        });
        const data = await res.json();
        if (live) {
          setAccess({
            loading: false,
            signedIn: Boolean(data.signedIn),
            subscribed: Boolean(data.subscribed),
            used: Number(data.used) || 0,
            limit: Number(data.limit) || 3,
          });
        }
      } catch {
        // Unknown is treated as free and signed in or out as Firebase says;
        // the server has the last word when a message is sent.
        if (live) setAccess({ ...LOADING, loading: false, signedIn: Boolean(user) });
      }
    })();
    return () => { live = false; };
  }, [user, subject]);

  /** One free message spent, counted here so the line updates without a refetch. */
  const incrementChat = useCallback(() => {
    setAccess((a) => (a.subscribed ? a : { ...a, used: a.used + 1 }));
  }, []);

  const canChat = access.subscribed || access.used < access.limit;
  return { user, access, canChat, incrementChat };
}
