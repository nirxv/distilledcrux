'use client';

import DOMPurify from 'dompurify';

/**
 * The one HTML sanitizer for anything rendered through dangerouslySetInnerHTML.
 *
 * app/chat/page.tsx carried its own, built from four regexes:
 *
 *   html.replace(/<script[\s\S]*?<\/script>/gi, '')
 *       .replace(/on\w+="[^"]*"/gi, '')
 *       .replace(/on\w+='[^']*'/gi, '')
 *       .replace(/javascript:/gi, '')
 *
 * The two handler patterns require quotes, so `<img src=x onerror=alert(1)>`
 * walks straight through, as does `<svg/onload=alert(1)>`. That mattered
 * because the input is model output built from RAG passages and, in book mode,
 * text the user uploaded — all of it reachable by prompt injection — and the
 * site's CSP allows 'unsafe-inline', so an injected handler executes.
 *
 * dompurify was already a dependency and had never been imported.
 */

// Preserved deliberately: `id` anchors the notes table of contents, `class`
// carries highlight styling (`mark.hl-yellow`), and `style` appears inline
// throughout the note corpus for list indentation. DOMPurify sanitizes CSS
// values rather than trusting them.
const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  // `data-citation` carries the source indices for a "Source #N" reference in
  // chat. app/chat/page.tsx finds it with closest('[data-citation]') to open
  // the cited passage. Blanket ALLOW_DATA_ATTR:false stripped it, so the span
  // still rendered and still looked like a link while the click did nothing:
  // a dead control rather than a visible failure. Named here so the one
  // attribute the UI depends on survives without re-admitting the rest.
  ADD_ATTR: ['target', 'data-citation'],
  // `href` on an anchor is still filtered by DOMPurify's own URI policy, which
  // rejects javascript: and data: regardless of what appears here.
  ALLOW_DATA_ATTR: false,
};

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  // A link opened in a new tab hands the opener to the destination unless this
  // is set, which is a tab-nabbing vector on model-authored links.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element && node.hasAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/** Last resort when DOMPurify cannot run: text only, no markup at all. */
function stripAllTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Returns `html` with scripts, event handlers and dangerous URLs removed.
 *
 * Call sites are client components whose content arrives from a fetch, so this
 * runs in the browser. If it is ever reached without a DOM — during a server
 * render — it degrades to plain text rather than passing markup through
 * unchecked, so the failure is visible instead of silent.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    return stripAllTags(html);
  }
  ensureHooks();
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}
