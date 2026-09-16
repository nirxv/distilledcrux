'use client';
import questions from '@/public/data/psir-pyqs.json';
import PyqDetail from '@/components/pyq/PyqDetail';
import type { PYQ } from '@/components/pyq/subjects';

export default function PolsciPyqDetailPage() {
  return <PyqDetail subject="polsci" questions={questions as PYQ[]} />;
}
