import { polsciNoteContent } from './polsci';
import { sociologyNoteContent } from './sociology';
import { anthropologyNoteContent } from './anthropology';
import { geographyNoteContent } from './geography';

export const noteContent: Record<string, string> = {
  ...sociologyNoteContent,
  ...anthropologyNoteContent,
  ...polsciNoteContent,
  ...geographyNoteContent,
};

export function getNoteContent(slug: string): string {
  return noteContent[slug] || '';
}
