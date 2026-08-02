import {{
  paper1Notes as sociologyP1,
  paper2Notes as sociologyP2,
  allNotes as sociologyAllNotes,
  paper1Sections as sociologyP1Sections,
  paper2Sections as sociologyP2Sections,
}} from './sociology';

import {{
  paper1Notes as anthropologyP1,
  paper2Notes as anthropologyP2,
}} from './anthropology';

export type {{ Note }} from './sociology';

export const paper1Notes = [...sociologyP1];
export const paper2Notes = [...sociologyP2];
export const allNotes = [...sociologyAllNotes, ...anthropologyP1, ...anthropologyP2];

export function getNoteBySlug(slug: string) {{
  return allNotes.find((n) => n.slug === slug);
}}

export const paper1Sections = sociologyP1Sections;
export const paper2Sections = sociologyP2Sections;
