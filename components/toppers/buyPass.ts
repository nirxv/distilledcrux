'use client';
import { auth } from '@/lib/firebase';

/**
 * Buys a topper pass through Razorpay: creates the order on the server, opens
 * checkout, and has the server verify the payment and grant the pass.
 *
 * Resolves 'done' once the pass is granted, 'login' when nobody is signed in,
 * 'cancelled' when the reader closes checkout. Throws with a message a reader
 * can act on otherwise.
 */

type Checkout = new (options: Record<string, unknown>) => { open(): void };

let script: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  if ((window as unknown as { Razorpay?: Checkout }).Razorpay) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => { script = null; s.remove(); reject(new Error('The payment window would not load. An ad blocker can stop it.')); };
    document.body.appendChild(s);
  });
  return script;
}

export async function buyTopperPass(subject: string): Promise<'done' | 'login' | 'cancelled'> {
  const user = auth.currentUser;
  if (!user) return 'login';
  await loadCheckout();
  const token = await user.getIdToken();
  const orderRes = await fetch('/api/toppers/pass/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-token': token },
    body: JSON.stringify({ subject }),
  });
  const order = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) throw new Error(order.error ?? 'Could not start the payment.');

  const Razorpay = (window as unknown as { Razorpay: Checkout }).Razorpay;
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Distilled Crux',
      image: 'https://www.distilledcrux.com/apple-icon.png',
      description: order.description,
      order_id: order.orderId,
      prefill: { email: user.email ?? '', name: user.displayName ?? '' },
      theme: { color: '#4361ee' },
      handler: async (r: Record<string, string>) => {
        try {
          const fresh = await user.getIdToken();
          const res = await fetch('/api/toppers/pass/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-token': fresh },
            body: JSON.stringify({
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            }),
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.success) resolve('done');
          else reject(new Error('Your payment went through but the pass could not be confirmed. Write to us and we will sort it out.'));
        } catch {
          reject(new Error('Your payment went through but the pass could not be confirmed. Write to us and we will sort it out.'));
        }
      },
      modal: { ondismiss: () => resolve('cancelled') },
    });
    rzp.open();
  });
}
