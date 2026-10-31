/**
 * A chat answer about an uploaded PDF from Gemini 2.5 Flash, streamed.
 *
 * Used while DeepSeek stands in for Claude (lib/claude.ts): DeepSeek can't
 * read PDFs, and Gemini reads them whole, scans and handwriting included.
 * The PDF goes with the first user turn, as it did for Claude.
 */
const MODEL = 'gemini-2.5-flash';
// Room to think before answering. It reads handwriting better for it, and
// thinking counts against the output limit, so it is added on top.
const THINK = 2048;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function streamGeminiPdf(opts: {
  system: string;
  messages: { role: string; content: unknown }[];
  pdfBase64: string;
  maxTokens: number;
  onText: (text: string) => void;
}): Promise<boolean> {
  const contents: { role: 'user' | 'model'; parts: Part[] }[] = opts.messages
    .map((m) => ({ role: m.role === 'assistant' ? ('model' as const) : ('user' as const), parts: [{ text: typeof m.content === 'string' ? m.content : '' }] as Part[] }))
    .filter((c) => (c.parts[0] as { text: string }).text.trim());
  const first = contents.findIndex((c) => c.role === 'user');
  if (first === -1) contents.unshift({ role: 'user', parts: [{ text: 'Please analyse this PDF.' }] });
  contents[Math.max(first, 0)].parts.unshift({ inline_data: { mime_type: 'application/pdf', data: opts.pdfBase64 } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    signal: AbortSignal.timeout(80_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents,
      generationConfig: { maxOutputTokens: opts.maxTokens + THINK, thinkingConfig: { thinkingBudget: THINK } },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Gemini PDF ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);

  // Server-sent events, one JSON chunk per "data:" line.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finish = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const chunk = JSON.parse(line.slice(5));
        const parts: { text?: string; thought?: boolean }[] = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) if (p.text && !p.thought) opts.onText(p.text);
        finish = chunk.candidates?.[0]?.finishReason ?? finish;
      } catch { /* a partial line; the rest arrives with the next read */ }
    }
  }
  // True when the answer ended on its own, not at the length limit.
  return finish === 'STOP';
}
