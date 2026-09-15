import 'server-only';
import type React from 'react';
import type { AdminViewServerProps } from 'payload';

/**
 * Wraps a custom admin view so its body cannot run for a signed-out visitor.
 *
 * This is not belt-and-braces. Payload does not gate a custom view's server
 * component the way it gates its own screens: on a signed-out request it
 * renders the login chrome but still renders the custom view and streams its
 * RSC payload with the page. Measured on this repo before the guard existed, a
 * request to /cms/subscribers carrying no session returned a live subscriber's
 * email address inside the flight data.
 *
 * These views also read through the service-role Supabase client, which
 * bypasses RLS, so nothing downstream would have caught it either.
 *
 * Returning null leaves Payload's login screen exactly as it was.
 */
export function cmsView<P extends Partial<AdminViewServerProps>>(
  render: (props: P) => Promise<React.ReactElement | null>,
): (props: P) => Promise<React.ReactElement | null> {
  return async function GuardedView(props: P) {
    if (!props?.initPageResult?.req?.user) return null;
    return render(props);
  };
}
