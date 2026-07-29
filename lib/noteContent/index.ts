import { sociologyNoteContent } from './sociology';

export const noteContent: Record<string, string> = {
  ...sociologyNoteContent,
};

export function getNoteContent(slug: string): string {
  return noteContent[slug] || '';
}
