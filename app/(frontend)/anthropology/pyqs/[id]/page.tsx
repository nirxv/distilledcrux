'use client';
import questions from '@/public/data/anthropology-pyqs.json';
import PyqDetail from '@/components/pyq/PyqDetail';
import type { PYQ } from '@/components/pyq/subjects';

export default function AnthropologyPyqDetailPage() {
  return <PyqDetail subject="anthropology" questions={questions as PYQ[]} />;
}
