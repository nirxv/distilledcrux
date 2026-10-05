/**
 * Each optional's past questions, for the PYQ list and question pages.
 *
 * Server-only. The question pages used to import a subject's whole file into
 * the browser, 185 to 346 KB of JSON to show one question; now the server
 * picks out what a page needs and only that is sent.
 */

export type PyqSubject = 'sociology' | 'anthropology' | 'polsci' | 'geography' | 'pub-admin';

export type Pyq = {
  id: number;
  year: string;
  paper: 'Paper I' | 'Paper II';
  /** "Section A" or "Section B", where the paper records it. */
  section: string | null;
  marks: number | null;
  question: string;
  topic: string;
  /** Anthropology tags a narrower theme inside the topic. */
  microtheme: string | null;
};

export type PyqTopic = { name: string; paper: 'Paper I' | 'Paper II'; p1: number; p2: number };

export const PYQ_SUBJECT_NAME: Record<PyqSubject, string> = {
  sociology: 'Sociology',
  anthropology: 'Anthropology',
  polsci: 'PSIR',
  geography: 'Geography',
  'pub-admin': 'Public Administration',
};

export function isPyqSubject(value: string): value is PyqSubject {
  return value in PYQ_SUBJECT_NAME;
}

const LOADERS: Record<PyqSubject, () => Promise<{ default: unknown[] }>> = {
  sociology: () => import('@/public/data/sociology-pyqs.json'),
  anthropology: () => import('@/public/data/anthropology-pyqs.json'),
  polsci: () => import('@/public/data/psir-pyqs.json'),
  geography: () => import('@/public/data/geography-pyqs.json'),
  'pub-admin': () => import('@/public/data/pubad-pyqs.json'),
};

/**
 * Syllabus order, from the lists the old pages typed out by hand. Those lists
 * were also the topic filter, and they had drifted from the data: sociology's
 * left out two topics that have questions, geography's offered one with none,
 * and anthropology's named only 11 of its 47, so most of its questions could
 * not be filtered at all. The filter is now built from the data, and these
 * only decide the order. A topic missing here falls in by the order its
 * questions appear, which follows the syllabus in the files that lack a list.
 */
const SYLLABUS_ORDER: Record<PyqSubject, string[]> = {
  sociology: ['Sociology as Science', 'Social Research Methods', 'Sociological Thinkers', 'Social Stratification', 'Social Mobility', 'Social Movements', 'Religion and Society', 'Politics and Society', 'Economy and Society', 'Family and Marriage', 'Education and Society', 'Social Change', 'Indian Society', 'Indian Villages', 'Tribal Society', 'Caste System', 'Agrarian Structure', 'Industry and Labour', 'Weaker Sections', 'Social Movements in India'],
  anthropology: ['Tribal Situation in India', 'Problems of Tribal Communities', 'Developmental Projects and Tribal Displacement', 'Constitutional Safeguards and Exploitation', 'Social Change and Contemporary Tribal Societies', 'Ethnicity and Tribal Unrest', 'Impact of Religions on Tribal Societies', 'Tribe and Nation State', 'History and Administration of Tribal Areas', 'Role of Anthropology in Tribal Development', 'Contributions of Anthropology'],
  polsci: ['Political Theory', 'Theories of the State', 'Justice', 'Equality', 'Rights', 'Democracy', 'Concept of Power, Hegemony, Ideology and Legitimacy', 'Political Ideologies', 'Indian Political Thought', 'Western Political Thinkers', 'Indian Nationalism', 'Making of the Indian Constitution', 'Salient Features of the Indian Constitution', 'Principal Organs', 'Grassroots Democracy', 'Statutory Institutions and Commissions', 'Federalism', 'Planning and Economic Development', 'Indian Politics: Caste, Religion and Ethnicity', 'Party System', 'Social Movements', 'Comparative Political', 'State in Comparative Perspective', 'Politics of Representation and Participation', 'Globalization', 'Approaches to the Study of International Relations', 'Key Concepts in International Relations', 'Changing International Political Order', 'Evolution of the International Economic System', 'United Nations', 'Regionalisation of World Politics', 'Contemporary Global Concerns', "India's Foreign Policy: Changing International Order", 'India and the Non-Alignment Movement', 'India and South Asia', 'India and the Global South', 'India and the Global Centres of Power', 'India and the UN System', 'India and the Nuclear Question', 'Recent Developments in Indian Foreign Policy'],
  geography: ['Geomorphology', 'Climatology', 'Oceanography', 'Biogeography', 'Environmental Geography', 'Geographical Thought & Methods', 'Population & Settlement', 'Economic Geography', 'Agriculture', 'Industries', 'Transport & Trade', 'Disasters & Hazards', 'India: Physical', 'India: Climate', 'India: Agriculture & Resources', 'India: Industries & Economy', 'India: Population & Urbanization', 'India: Transport & Regional Development'],
  'pub-admin': ['Introduction to Public Administration', 'Theories of Organisation', 'Administrative Behaviour', 'Accountability and Control', 'Administrative Law', 'Comparative Public Administration', 'Development Dynamics', 'Personnel Administration', 'Public Policy', 'Techniques of Administrative Improvement', 'Financial Administration', 'New Public Management', 'General', 'Evolution of Indian Administration', 'Constitutional Framework', 'Public Sector Undertakings', 'Union Government and Administration', 'Plans and Priorities', 'State Government and Administration', 'District Administration', 'Civil Services in India', 'Local Government in India', 'Law, Order and Anti-Corruption', 'Welfare Administration', 'Administrative Reforms in India', 'Rural Development Administration', 'Significant Issues in Indian Administration'],
};

const cache = new Map<PyqSubject, { questions: Pyq[]; topics: PyqTopic[] }>();

function normalise(r: Record<string, unknown>): Pyq | null {
  const question = String(r.question ?? '').trim();
  const id = Number(r.id);
  if (!question || !Number.isFinite(id)) return null;
  const marks = Number(r.marks);
  const rawSection = String(r.section ?? '').trim();
  return {
    id,
    year: String(r.year ?? '').trim(),
    paper: r.paper === 'Paper II' ? 'Paper II' : 'Paper I',
    // Geography records the section as a bare letter.
    section: rawSection ? (rawSection.startsWith('Section') ? rawSection : `Section ${rawSection}`) : null,
    marks: Number.isFinite(marks) && marks > 0 ? marks : null,
    question,
    topic: String(r.topic ?? '').trim() || 'General',
    microtheme: String(r.microtheme ?? '').trim() || null,
  };
}

/**
 * A subject's questions, newest paper first, Paper I before Paper II within a
 * year, then in file order; and its topics in syllabus order, each with how
 * many questions it has in either paper.
 */
export async function loadPyqs(subject: PyqSubject): Promise<{ questions: Pyq[]; topics: PyqTopic[] }> {
  const cached = cache.get(subject);
  if (cached) return cached;

  const rows = (await LOADERS[subject]()).default as Record<string, unknown>[];
  const fileOrder = new Map<number, number>();
  const questions: Pyq[] = [];
  rows.forEach((r, i) => {
    const q = normalise(r);
    if (!q) return;
    fileOrder.set(q.id, i);
    questions.push(q);
  });
  questions.sort((a, b) =>
    b.year.localeCompare(a.year) || a.paper.localeCompare(b.paper) || fileOrder.get(a.id)! - fileOrder.get(b.id)!);

  const tally = new Map<string, { p1: number; p2: number; first: number }>();
  for (const q of questions) {
    const t = tally.get(q.topic) ?? { p1: 0, p2: 0, first: Infinity };
    if (q.paper === 'Paper I') t.p1++; else t.p2++;
    t.first = Math.min(t.first, q.id);
    tally.set(q.topic, t);
  }
  const listed = SYLLABUS_ORDER[subject];
  const rank = (name: string, first: number) => {
    const i = listed.indexOf(name);
    return i >= 0 ? i : listed.length + first;
  };
  const topics: PyqTopic[] = [...tally.entries()]
    // A topic belongs to the paper most of its questions were set in.
    .map(([name, t]) => ({ name, paper: (t.p2 > t.p1 ? 'Paper II' : 'Paper I') as PyqTopic['paper'], p1: t.p1, p2: t.p2, first: t.first }))
    .sort((a, b) => a.paper.localeCompare(b.paper) || rank(a.name, a.first) - rank(b.name, b.first))
    .map(({ name, paper, p1, p2 }) => ({ name, paper, p1, p2 }));

  const loaded = { questions, topics };
  cache.set(subject, loaded);
  return loaded;
}
