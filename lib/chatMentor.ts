/**
 * Mentor answers arrive as `##NAME## … ##END##` sections (see the mentor
 * prompt in lib/prompts.ts), which the chat page draws as labelled cards.
 *
 * The model sometimes dresses the markers as bold: `**##DIAGNOSIS##**`,
 * `**##END##**`. Left alone, the asterisks outside each marker end up as
 * stray `**` lines in the cards, and the pair between two sections reaches
 * formatMessage as `**`, blank line, `**`, which used to render as the raw
 * text `___H3___` / `___END___`.
 */
export type MentorSection = { type: string; content: string };

/** Strips emphasis wrapped around a marker, and lines that are only `*` or `**`. */
export function normalizeMentor(text: string): string {
  return text
    .replace(/([*_]{1,3})[ \t]*(##[A-Z]+##)[ \t]*\1/g, '$2')
    .replace(/^[ \t]*\*{1,2}[ \t]*$/gm, '');
}

export function parseMentorSections(raw: string): MentorSection[] {
  const text = normalizeMentor(raw);
  const sections: MentorSection[] = [];
  const regex = /##([A-Z]+)##([\s\S]*?)##END##/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) sections.push({ type: 'TEXT', content: before });
    sections.push({ type: match[1], content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  const after = text.slice(lastIndex).trim();
  if (after) sections.push({ type: 'TEXT', content: after });
  if (sections.length === 0) sections.push({ type: 'TEXT', content: text });
  return sections;
}
