import Anthropic from '@anthropic-ai/sdk';

/**
 * Every Claude call goes through here, so the provider can be switched
 * without touching the routes.
 *
 * With CLAUDE_VIA=deepseek, the same requests go to DeepSeek's
 * Anthropic-compatible endpoint and are served by deepseek-flash, for while
 * the Anthropic balance is empty. It reads images but not PDFs, so a route
 * that sends a PDF checks claudeReadsPdf() first. Unset the variable to go
 * back to Claude.
 */
const DEEPSEEK_URL = 'https://api.deepseek.com/anthropic';

export const viaDeepSeek = () => process.env.CLAUDE_VIA === 'deepseek' && Boolean(process.env.DEEPSEEK_API_KEY);

/** Whether the model behind claudeClient() takes PDF documents. */
export const claudeReadsPdf = () => !viaDeepSeek();

export function claudeClient(): Anthropic {
  return viaDeepSeek()
    ? new Anthropic({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: DEEPSEEK_URL })
    : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * A request as the provider needs it. On DeepSeek the model is deepseek-flash
 * and its thinking is off, unless `think`: for reading handwriting, which it
 * does noticeably better after thinking. Thinking counts against max_tokens,
 * so it gets room on top. `deepSeekMaxTokens` is for replies DeepSeek writes
 * at more length than Claude, where Claude's limit would cut them off.
 */
export function claudeRequest<T extends { model: string; max_tokens: number }>(
  params: T,
  opts: { think?: boolean; deepSeekMaxTokens?: number } = {},
): T {
  if (!viaDeepSeek()) return params;
  const max = Math.max(params.max_tokens, opts.deepSeekMaxTokens ?? 0);
  return opts.think
    ? { ...params, model: 'deepseek-flash', max_tokens: max + 6000 }
    : { ...params, model: 'deepseek-flash', max_tokens: max, thinking: { type: 'disabled' } };
}

/** The reply's text, without any thinking blocks before it. */
export function claudeText(message: { content: { type: string }[] }): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
