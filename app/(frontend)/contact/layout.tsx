import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The page is a client component, which cannot export metadata itself.
export const metadata: Metadata = {
  title: 'Contact',
  description: 'Write to the Distilled Crux team about a bug, a payment, a refund or a topic you want covered.',
  alternates: { canonical: 'https://distilledcrux.com/contact' },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
