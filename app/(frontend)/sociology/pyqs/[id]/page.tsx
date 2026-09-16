'use client';
import questions from '@/public/data/sociology-pyqs.json';
import PyqDetail from '@/components/pyq/PyqDetail';
import type { PYQ } from '@/components/pyq/subjects';

export default function SociologyPyqDetailPage() {
  return <PyqDetail subject="sociology" questions={questions as PYQ[]} />;
}
