import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'Public Administration PYQs — Coming Soon | Distilled Crux',
  description:
    'The Public Administration previous year question bank is being prepared. Notes for all 22 topics are available now.',
};

export default function PubAdminPyqsComingSoon() {
  return (
    <ComingSoon
      title="Public Administration PYQ bank"
      body="We are tagging the previous year questions topic by topic against the Paper I and Paper II syllabus. Until it is ready, the full notes for all 22 topics are live."
      backHref="/notes/pub-admin"
      backLabel="Read the notes"
    />
  );
}
