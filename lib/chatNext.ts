import { cleanSuggestion } from './chatSuggestions';
import { SUBJECT_DISPLAY, type SubjectKey } from './subjectConfig';

/**
 * The follow-up question the chat input suggests after an answer, the way a
 * terminal suggests the next command: written for this exchange, not drawn
 * from a list.
 *
 * It rides at the end of the /api/chat stream rather than being a request of
 * its own, so it costs no second sign-in check, quota read or rate-limit
 * write. A small, fast model does it (about 170 ms), after the answer has
 * been sent, so it never delays the answer itself. Any failure, slow reply
 * or unusable output means no suggestion, never an error.
 */
function system(subject: SubjectKey): string {
  const name = SUBJECT_DISPLAY[subject];
  return `You write the one follow-up question a UPSC ${name} Optional aspirant is most likely to type next, given the question they asked and the answer they got.

Move them forward: go one level deeper into something the answer raised, ask what a thinker or scholar named in the answer argues about it, link it to a related topic in the syllabus, or turn it into exam practice. Never repeat or rephrase the question they already asked.

Name a thinker or scholar only if that exact name appears in the answer. Never introduce a thinker, book, date, case or example that the answer does not mention: an invented name in a suggestion sends an aspirant looking for a scholar who does not exist.

Write it the way the aspirant would type it: plain words, under 80 characters, one question ending with a question mark. Output only the question.`;
}

function excerpt(answer: string): string {
  return answer
    .replace(/[[(（【]?\s*(?:Sources?|स्रोत)\s*#?\s*[\d०-९]+(?:\s*(?:,|and|और|&)\s*#?\s*[\d०-९]+)*\s*[\])）】]?/gi, '')
    .replace(/[#*_>|`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

export async function suggestNext(
  question: string,
  answer: string,
  lang: 'hi' | 'en',
  subject: SubjectKey,
): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || !question.trim() || !answer.trim()) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        reasoning_effort: 'low',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system(subject) + (lang === 'hi' ? '\n\nWrite the question in Hindi, in Devanagari script.' : '') },
          { role: 'user', content: `Question: ${question.slice(0, 600)}\n\nAnswer (excerpt): ${excerpt(answer)}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return cleanSuggestion(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}
