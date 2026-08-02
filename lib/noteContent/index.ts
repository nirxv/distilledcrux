import { sociologyNoteContent } from './sociology';
import { anthropologyNoteContent } from './anthropology';

export const noteContent: Record<string, string> = {
  ...sociologyNoteContent,
  ...anthropologyNoteContent,
};

export function getNoteContent(slug: string): string {
  return noteContent[slug] || '';
}
