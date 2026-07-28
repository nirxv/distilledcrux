import { adminAuth } from '@/lib/firebaseAdmin';

export async function verifyFirebaseToken(
  token: string | null
): Promise<{ uid: string; email?: string } | null> {
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
