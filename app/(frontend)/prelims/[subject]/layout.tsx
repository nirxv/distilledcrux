/**
 * Builds each prelims subject page with the site. The page is a client
 * component, which cannot export generateStaticParams, so it lives here;
 * without it every visit rendered the page on the server. The slugs are the
 * keys of SUBJECTS in page.tsx.
 */
export function generateStaticParams() {
  return ['history', 'polity', 'geography', 'economy', 'environment', 'science', 'current', 'csat'].map((subject) => ({ subject }));
}

export default function PrelimsSubjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
