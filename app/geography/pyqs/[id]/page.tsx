'use client';
import questions from '@/public/data/geography-pyqs.json';
import PyqDetail from '@/components/pyq/PyqDetail';
import type { PYQ } from '@/components/pyq/subjects';

export default function GeographyPyqDetailPage() {
  return <PyqDetail subject="geography" questions={questions as PYQ[]} />;
}
