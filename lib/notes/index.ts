import { paper1Notes as socP1, paper2Notes as socP2, allNotes as socAll } from './sociology';
import { paper1Notes as anthP1, paper2Notes as anthP2 } from './anthropology';
import { paper1Notes as polP1, paper2Notes as polP2 } from './polsci';
import { paper1Notes as geoP1, paper2Notes as geoP2 } from './geography';
import { paper1Notes as paP1, paper2Notes as paP2 } from './pub-admin';

export type { Note } from './sociology';

export const paper1Notes = [...socP1];
export const paper2Notes = [...socP2];

export const allNotes = [
  ...socAll,
  ...anthP1, ...anthP2,
  ...polP1, ...polP2,
  ...geoP1, ...geoP2,
  ...paP1, ...paP2,
];

export function getNoteBySlug(slug: string) {
  return allNotes.find((n) => n.slug === slug);
}

export const paper1Sections = ['Fundamentals of Sociology', 'Social Structure', 'Social Stratification', 'Politics and Society', 'Religion and Society', 'Systems of Kinship', 'Social Change in Modern Society'];
export const paper2Sections = ['Introducing Indian Society', 'Social Structure', 'Social Stratification', 'Challenges of Social Transformation'];
