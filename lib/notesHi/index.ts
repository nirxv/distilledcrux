/**
 * Hindi note catalogue: titles, descriptions, subtopics and section names.
 *
 * The English catalogue is the source and the key. Imported on the server only,
 * so the Hindi copy costs the client nothing.
 */
import { NOTE_HI as SOC, SECTION_HI as SOC_S } from './sociology';
import { NOTE_HI as ANTH, SECTION_HI as ANTH_S } from './anthropology';
import { NOTE_HI as POL, SECTION_HI as POL_S } from './polsci';
import { NOTE_HI as GEO, SECTION_HI as GEO_S } from './geography';
import { NOTE_HI as PA, SECTION_HI as PA_S } from './pub-admin';

type Entry = { title: string; description: string; subtopics: string[] };

const NOTES: Record<string, Record<string, Entry>> = {
  sociology: SOC,
  anthropology: ANTH,
  polsci: POL,
  geography: GEO,
  'pub-admin': PA,
};

const SECTIONS: Record<string, Record<string, string>> = {
  sociology: SOC_S,
  anthropology: ANTH_S,
  polsci: POL_S,
  geography: GEO_S,
  'pub-admin': PA_S,
};

export function getNoteHi(subject: string, slug: string): Entry | null {
  return NOTES[subject]?.[slug] ?? null;
}

export function getSectionHi(subject: string, section: string): string | null {
  return SECTIONS[subject]?.[section] ?? null;
}

export function getSubjectCatalogueHi(subject: string): Record<string, Entry> {
  return NOTES[subject] ?? {};
}

export function getSectionsHi(subject: string): Record<string, string> {
  return SECTIONS[subject] ?? {};
}

export function isTranslated(subject: string, slug: string): boolean {
  return Boolean(NOTES[subject]?.[slug]);
}
