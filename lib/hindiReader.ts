/**
 * A second reading for answers written in Hindi.
 *
 * Pixtral, which reads every answer first, garbles Devanagari handwriting:
 * on history-optional it put Marathi words in Hindi sentences, invented names
 * ("Arthur C. Desi" for R.C. Dutt) and a question nobody asked, and the marker
 * then blamed students for its mistakes. When its reading comes back mostly in
 * Devanagari, every page is read again with Mistral OCR.
 *
 * Which reader is decided by what was written, so an English answer stays on
 * Pixtral.
 */

export const mostlyDevanagari = (t: string) => {
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  const deva = (t.match(/[ऀ-ॿ]/g) ?? []).length;
  return letters > 40 && deva / letters > 0.5;
};

/** Mistral OCR's markdown as plain transcript text. */
const plainText = (md: string) => md
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')           // images it found on the page
  .replace(/^#{1,6}\s*/gm, '')                      // headings
  .replace(/(\*\*|__)(.*?)\1/g, '$2')                // bold
  .replace(/\$\\(?:rightarrow|to)\$/g, '→').replace(/\$\\leftarrow\$/g, '←')
  .replace(/\$([^$\n]{1,40})\$/g, '$1')             // short inline maths
  .replace(/\n{3,}/g, '\n\n')
  .trim();

async function readPage(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-ocr-latest', document: { type: 'image_url', image_url: dataUrl } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md = (data.pages ?? []).map((p: { markdown?: string }) => p.markdown ?? '').join('\n\n');
    return md.trim() ? plainText(md) : null;
  } catch {
    return null;
  }
}

/**
 * The OCR model reads the whole page and takes no instructions, so the
 * question written at the top comes through with the answer. A small text
 * model picks it out of the first page; it is then taken off the transcript,
 * but only where it appears word for word near the start.
 */
async function splitQuestion(firstPage: string): Promise<string> {
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `Below is the text read from the first page of a handwritten UPSC answer sheet. If the page begins with the question being answered (often underlined or labelled प्रश्न, Q or Q.), return that question exactly as it appears, character for character, including any label. If the page starts directly with the answer, return an empty string.\n\nReply only with JSON: {"question": "..."}\n\nPAGE TEXT:\n${firstPage.slice(0, 2000)}`,
        }],
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const q = JSON.parse(data.choices?.[0]?.message?.content ?? '{}').question;
    return typeof q === 'string' ? q.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Every page read by Mistral OCR, with the question split off the answer.
 * Null if any page fails, so Pixtral's reading stands.
 */
export async function readHindi(dataUrls: string[]): Promise<{ text: string; question: string } | null> {
  const pages = await Promise.all(dataUrls.map(readPage));
  if (pages.some((p) => !p)) return null;
  let text = (pages as string[]).join('\n\n');
  const question = await splitQuestion(pages[0] as string);
  if (question) {
    const at = text.indexOf(question);
    if (at !== -1 && at < 300) text = text.slice(at + question.length).replace(/^[\s:.\-–—]+/, '');
  }
  return { text, question: question.replace(/^(प्रश्न|प्र|Q|Ques|Question)\s*[\d.]*\s*[:.)\-–—]?\s*/i, '') };
}
