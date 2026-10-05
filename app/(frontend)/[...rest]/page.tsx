import { notFound } from 'next/navigation';

/**
 * Any path nothing else matches, two segments deep or more, gets the site's
 * own 404 rather than the framework's unstyled one. One segment already
 * lands on [optional], which does the same.
 */
export default function Unmatched() {
  notFound();
}
