import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadSharedCheck } from '@/lib/sharedCheck';
import { SITE } from '@/lib/referral';
import SharedCheckView from '@/components/share/SharedCheckView';

// Each card renders on its first visit and is kept until the reader stops
// sharing it (/api/share revalidates the path) or the next deploy.
export async function generateStaticParams() {
  return [];
}

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const check = await loadSharedCheck(id);
  if (!check) return { title: { absolute: 'Answer check: Distilled Crux' }, robots: { index: false } };
  const title = `${check.marks}/${check.outOf} on a UPSC ${check.subject} answer`;
  const description = check.question.length > 160 ? check.question.slice(0, 157).trimEnd() + '…' : check.question;
  return {
    title: { absolute: `${title}: Distilled Crux` },
    description,
    // A reader's own work, shared with friends, not for search results.
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `${SITE}/s/${id}`, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharedCheckPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const check = await loadSharedCheck(id);
  if (!check) notFound();
  return <SharedCheckView check={check} />;
}
