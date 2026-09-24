'use client';
import questions from '@/public/data/pubad-pyqs.json';
import PyqDetail from '@/components/pyq/PyqDetail';
import type { PYQ } from '@/components/pyq/subjects';

export default function PubAdminPyqDetailPage() {
  return <PyqDetail subject="pub-admin" questions={questions as PYQ[]} />;
}
