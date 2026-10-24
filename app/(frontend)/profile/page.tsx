import type { Metadata } from 'next';
import ProfileSettings from '@/components/profile/ProfileSettings';

export const metadata: Metadata = {
  title: { absolute: 'Profile and settings | Distilled Crux' },
  robots: { index: false },
};

export default function ProfilePage() {
  return <ProfileSettings />;
}
