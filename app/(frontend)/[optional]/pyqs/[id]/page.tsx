import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PyqDetail from '@/components/pyq/PyqDetail';
import { PYQ_SUBJECT_NAME, isPyqSubject, loadPyqs } from '@/lib/pyqs';

/**
 * One past question. The server finds it and its neighbours and sends only
 * those; the page used to load the subject's whole question file in the
 * browser to show a single question.
 */

type Params = { optional: string; id: string };

// Built the first time each question is opened, then served as a static page.
export async function generateStaticParams() {
  return [];
}

async function find(optional: string, id: string) {
  if (!isPyqSubject(optional)) return null;
  const { questions } = await loadPyqs(optional);
  const i = questions.findIndex((q) => String(q.id) === id);
  if (i < 0) return null;
  return { questions, i, pyq: questions[i] };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { optional, id } = await params;
  const found = await find(optional, id);
  if (!found || !isPyqSubject(optional)) return {};
  const { pyq } = found;
  const name = PYQ_SUBJECT_NAME[optional];
  const short = pyq.question.length > 70 ? `${pyq.question.slice(0, 67).trimEnd()}…` : pyq.question;
  return {
    title: `${short} | ${name} ${pyq.year} ${pyq.paper}`,
    description: `UPSC ${name} optional, ${pyq.year} ${pyq.paper}${pyq.marks ? `, ${pyq.marks} marks` : ''}: ${pyq.question.slice(0, 150)}`,
    alternates: { canonical: `https://distilledcrux.com/${optional}/pyqs/${pyq.id}` },
  };
}

export default async function PyqPage({ params }: { params: Promise<Params> }) {
  const { optional, id } = await params;
  const found = await find(optional, id);
  if (!found || !isPyqSubject(optional)) notFound();
  const { questions, i, pyq } = found;

  // The same topic, nearest years first, leaving this one out.
  const related = questions.filter((q) => q.topic === pyq.topic && q.id !== pyq.id).slice(0, 5);
  // Neighbours in the order the list shows them: newest paper first.
  const peek = (j: number) => (j >= 0 && j < questions.length ? { id: questions[j].id, question: questions[j].question } : null);

  return (
    <PyqDetail
      subject={optional}
      subjectName={PYQ_SUBJECT_NAME[optional]}
      pyq={pyq}
      related={related}
      prev={peek(i - 1)}
      next={peek(i + 1)}
      topicCount={questions.filter((q) => q.topic === pyq.topic).length}
    />
  );
}
