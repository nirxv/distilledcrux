/**
 * Styles for the topper copy pages. Kept out of the client components: a
 * server page that imports a string from a 'use client' file gets a client
 * reference, not the string, and the <style> it writes is empty.
 */

export const TOPPER_BROWSER_CSS = `
.tb { max-width: 880px; }
.tb-allow { margin: 0 0 var(--space-3); padding: 10px 14px; border-radius: var(--radius-lg); background: var(--ds-soft); border: 1px solid var(--border); font-size: 0.92rem; color: var(--text2); }
.tb-allow.on { background: var(--success-wash); border-color: transparent; color: var(--success-text); font-weight: 600; }
.tb-allow a { color: var(--accent-text); font-weight: 600; }
.tb-allow-offer { display: flex; flex-direction: column; gap: var(--space-2); }
.tb-allow-note { margin: 0; }
.tb-bar { position: sticky; top: 60px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.tb-search { flex: 1 1 340px; display: flex; align-items: center; gap: var(--space-2); height: 48px; padding: 0 var(--space-2) 0 var(--space-4); background: var(--ds-card); border: 1.5px solid var(--border2); border-radius: var(--radius-full); color: var(--text3); }
.tb-search:focus-within { border-color: color-mix(in srgb, var(--accent) 65%, transparent); box-shadow: 0 0 0 4px var(--accent-glow); }
.tb-search input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: none; color: var(--text); font-size: 1rem; }
.tb-search input::-webkit-search-cancel-button { display: none; }
.tb-clear { width: 32px; height: 32px; border: none; border-radius: 50%; background: var(--ds-soft); color: var(--text3); cursor: pointer; font-size: 0.8rem; }
.tb-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.tb-tab { display: inline-flex; align-items: center; gap: var(--space-2); padding: 9px 16px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font-size: 0.92rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
.tb-tab span { min-width: 24px; padding: 1px 7px; border-radius: var(--radius-full); background: var(--ds-card); font-size: 0.76rem; font-weight: 600; color: var(--text3); }
.tb-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.tb-tab.on span { background: var(--w); color: var(--t); }
.tb-selects { display: flex; flex-wrap: wrap; gap: var(--space-2); width: 100%; }
.tb-select {
  appearance: none; -webkit-appearance: none; min-width: 0; max-width: 100%; height: 40px; padding: 0 34px 0 14px;
  background: var(--ds-card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 13px center;
  border: 1px solid var(--border2); border-radius: var(--radius-full); color: var(--text); font: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer; text-overflow: ellipsis;
}
.tb-select.set { border-color: color-mix(in srgb, var(--t) 50%, transparent); background-color: var(--w); color: var(--t); font-weight: 600; }
.tb-select-topic { flex: 1 1 200px; max-width: 320px; }
.tb-toggle { height: 40px; padding: 0 16px; border: 1px solid var(--border2); border-radius: var(--radius-full); background: var(--ds-card); color: var(--text2); font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.tb-toggle.on { border-color: color-mix(in srgb, var(--t) 50%, transparent); background: var(--w); color: var(--t); }
.tb-status { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin: var(--space-2) 0 var(--space-3); font-size: 0.95rem; color: var(--text2); }
.tb-status strong { color: var(--text); font-weight: 600; }
.tb-reset { background: none; border: none; padding: 4px 0; font: inherit; font-size: 0.9rem; font-weight: 600; color: var(--accent-text); cursor: pointer; white-space: nowrap; }
.tb-empty { color: var(--text2); }
.tb-cards { display: flex; flex-direction: column; gap: var(--space-3); }
.tb-card { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4) var(--space-5); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.tb-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 0.82rem; color: var(--text3); }
.tb-paper { font-weight: 700; color: var(--t); }
.tb-topic { padding: 2px 10px; border-radius: var(--radius-full); border: 1px solid var(--border); background: var(--ds-soft); color: var(--text2); font: inherit; font-size: 0.8rem; cursor: pointer; }
.tb-topic:hover, .tb-topic.on { border-color: color-mix(in srgb, var(--t) 45%, transparent); color: var(--t); background: var(--w); }
.tb-marks { margin-left: auto; padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); color: var(--text2); font-weight: 600; }
.tb-q { margin: 0; font-size: 1.04rem; font-weight: 500; line-height: 1.6; color: var(--text); }
.tb-q mark, .tb-name mark { background: color-mix(in srgb, var(--premium-text) 26%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
.tb-asked { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; font-size: 0.82rem; }
.tb-asked span { font-weight: 700; color: var(--warning-text); }
.tb-asked a { padding: 2px 9px; border-radius: var(--radius-full); background: var(--warning-wash); color: var(--warning-text); font-weight: 600; text-decoration: none; }
.tb-asked a:hover { text-decoration: underline; text-underline-offset: 2px; }
.tb-toppers { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tb-copy { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-height: 44px; padding: 8px 14px; border-radius: var(--radius-lg); border: 1px solid var(--border2); background: var(--ds-card); color: var(--text); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.tb-copy:hover, .tb-copy.hit { border-color: color-mix(in srgb, var(--t) 55%, transparent); box-shadow: var(--elev-1); }
.tb-name { font-weight: 600; font-size: 0.95rem; }
.tb-rank { font-size: 0.8rem; color: var(--text3); }
.tb-opened { padding: 0 7px; border-radius: var(--radius-full); background: var(--success-wash); color: var(--success-text); font-size: 0.74rem; font-weight: 700; }
.tb-compare { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.tb-compare:hover { text-decoration: underline; text-underline-offset: 3px; }
.tb-more { display: flex; justify-content: center; padding: var(--space-4) 0; }
@media (max-width: 600px) {
  /* Pinned, four rows of filters would cover half a phone screen. */
  .tb-bar { position: static; gap: var(--space-2); padding-top: 0; }
  .tb-search { flex-basis: 100%; height: 46px; }
  .tb-tabs { width: 100%; }
  .tb-tab { flex: 1; justify-content: center; padding: 9px 6px; font-size: 0.86rem; }
  .tb-selects { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  .tb-select-topic { grid-column: 1 / -1; max-width: none; }
  .tb-card { padding: var(--space-4); }
  .tb-copy { width: 100%; }
}
`;

export const TOPPER_PDF_CSS = `
.tp { display: flex; flex-direction: column; min-width: 0; background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; }
.tp-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--ds-soft); font-size: 0.85rem; color: var(--text3); }
.tp-zoom { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.tp-zoom button { width: 32px; height: 32px; border: 1px solid var(--border2); border-radius: 50%; background: var(--ds-card); color: var(--text); font-size: 1.05rem; line-height: 1; cursor: pointer; }
.tp-zoom button:disabled { opacity: 0.4; cursor: default; }
.tp-zoom span { min-width: 44px; text-align: center; }
.tp-box { position: relative; overflow: auto; background: color-mix(in srgb, var(--ds-soft) 60%, var(--bg)); overscroll-behavior: contain; }
.tp-pages { padding: 10px; }
.tp-box.msg { display: flex; min-height: 300px; }
.tp-box.msg .tp-msg { position: static; flex: 1; }
.tp-page { display: block; margin: 0 auto 12px; background: #fff; border-radius: 3px; box-shadow: var(--elev-1); }
.tp-msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-6); text-align: center; color: var(--text2); }
.tp-msg strong { font-size: 1.05rem; color: var(--text); }
.tp-msg .ds-btn { margin-top: var(--space-2); }
.tp-spin { width: 22px; height: 22px; margin-bottom: var(--space-2); border: 2.5px solid var(--border2); border-top-color: var(--t, var(--accent)); border-radius: 50%; animation: tp-spin 0.8s linear infinite; }
@keyframes tp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .tp-spin { animation: none; } }
`;

export const TOPPER_VIEW_CSS = `
.tv-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--space-6); align-items: start; }
.tv-main { min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.tv-head { padding: var(--space-5) var(--space-6); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--elev-1); }
.tv-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 0.86rem; color: var(--text3); margin-bottom: var(--space-3); }
.tv-paper { padding: 2px 10px; border-radius: var(--radius-full); background: var(--w); color: var(--t); font-weight: 700; }
.tv-topic { padding: 2px 10px; border-radius: var(--radius-full); border: 1px solid var(--border); color: var(--text2); text-decoration: none; }
.tv-topic:hover { border-color: var(--t); color: var(--t); }
.tv-marks { margin-left: auto; padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); color: var(--text2); font-weight: 600; }
.tv-q { margin: 0 0 var(--space-3); font-size: clamp(1.12rem, 2.2vw, 1.36rem); font-weight: 600; line-height: 1.5; letter-spacing: -0.01em; color: var(--text); }
.tv-who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0; font-size: 1rem; }
.tv-who span { font-size: 0.9rem; color: var(--text3); }
.tv-asked { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border); }
.tv-asked-label { display: block; margin-bottom: var(--space-2); font-size: 0.82rem; font-weight: 700; color: var(--warning-text); }
.tv-asked ul { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.tv-asked a { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border-radius: var(--radius-lg); background: var(--warning-wash); color: var(--text); text-decoration: none; }
.tv-asked a:hover .tv-asked-q { text-decoration: underline; text-underline-offset: 2px; }
.tv-asked-year { font-size: 0.78rem; font-weight: 700; color: var(--warning-text); }
.tv-asked-q { font-size: 0.92rem; line-height: 1.45; }
.tv-aside { display: flex; flex-direction: column; gap: var(--space-4); position: sticky; top: 76px; }
.tv-side { padding: var(--space-4); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.tv-side-title { margin: 0 0 var(--space-3); font-size: 0.98rem; font-weight: 700; }
.tv-side-text { margin: 0 0 var(--space-3); font-size: 0.9rem; line-height: 1.55; color: var(--text2); }
.tv-others { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.tv-others li { display: flex; align-items: center; gap: 8px; }
.tv-other { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; padding: 8px 10px; border-radius: var(--radius-lg); border: 1px solid var(--border); color: var(--text); text-decoration: none; }
.tv-other:hover { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
.tv-other-name { font-weight: 600; font-size: 0.92rem; }
.tv-other-rank { font-size: 0.78rem; color: var(--text3); }
.tv-opened { padding: 0 7px; border-radius: var(--radius-full); background: var(--success-wash); color: var(--success-text); font-size: 0.72rem; font-weight: 700; }
.tv-cmp { flex-shrink: 0; padding: 8px 10px; font-size: 0.84rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.tv-cmp:hover { text-decoration: underline; text-underline-offset: 3px; }
.tv-all { font-size: 0.9rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
@media (max-width: 960px) {
  .tv-grid { grid-template-columns: 1fr; }
  .tv-aside { position: static; }
}
@media (max-width: 600px) {
  .tv-head { padding: var(--space-4); }
}
`;

export const TOPPER_COMPARE_CSS = `
.tc-note { margin: 0 0 var(--space-3); font-size: 0.9rem; color: var(--text2); }
.tc-switch { display: none; gap: 4px; padding: 4px; margin-bottom: var(--space-3); border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); }
.tc-tab { flex: 1; min-height: 40px; padding: 8px 10px; border: none; border-radius: var(--radius-full); background: none; color: var(--text2); font: inherit; font-size: 0.92rem; font-weight: 700; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tc-tab.on { background: var(--ds-card); color: var(--text); box-shadow: var(--elev-1); }
.tc-panes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); align-items: start; }
.tc-pane { min-width: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.tc-head { display: flex; flex-direction: column; gap: 6px; padding: var(--space-4); background: var(--ds-card); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.tc-pick { display: flex; flex-direction: column; gap: 4px; }
.tc-pick-label { font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text3); }
.tc-pick select { height: 42px; padding: 0 12px; border: 1px solid var(--border2); border-radius: var(--radius-lg); background: var(--ds-card); color: var(--text); font: inherit; font-size: 0.98rem; font-weight: 600; }
.tc-rank { margin: 0; font-size: 0.86rem; color: var(--text3); }
.tc-q { margin: 4px 0 0; font-size: 0.95rem; line-height: 1.5; color: var(--text); }
.tc-q span { display: block; font-size: 0.78rem; font-weight: 700; color: var(--t); }
.tc-open { align-self: flex-start; font-size: 0.84rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.tc-open:hover { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 860px) {
  .tc-switch { display: flex; }
  .tc-panes { grid-template-columns: 1fr; }
  .tc-pane { display: none; }
  .tc-pane.front { display: flex; }
}
`;

export const TOPPER_PASS_CSS = `
.tpo { display: flex; flex-direction: column; gap: var(--space-2); }
.tpo-card { width: 100%; max-width: 380px; margin-top: var(--space-2); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--ds-card); border: 1px solid var(--border); text-align: left; }
.tpo-line { padding-top: var(--space-2); border-top: 1px solid var(--border); }
.tpo-what { display: flex; flex-direction: column; gap: 2px; margin: 0; }
.tpo-what strong { font-size: 1rem; color: var(--text); }
.tpo-what span { font-size: 0.86rem; color: var(--text3); }
.tpo-acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.tpo-plans { font-size: 0.88rem; font-weight: 600; color: var(--accent-text); text-decoration: none; }
.tpo-plans:hover { text-decoration: underline; text-underline-offset: 3px; }
.tpo-err { margin: 0; font-size: 0.86rem; color: var(--danger-text); }
.tpo-done { margin: 0; padding: 10px 14px; border-radius: var(--radius-lg); background: var(--success-wash); color: var(--success-text); font-weight: 600; }
.tp-msg .tpo-card { align-self: center; }

.tco { display: flex; align-items: flex-start; gap: var(--space-4); margin: 0 0 var(--space-4); padding: var(--space-5); border-radius: var(--radius-xl); background: var(--ds-card); border: 1px solid var(--border); text-align: left; }
.tco-icon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-lg); background: var(--accent-dim); color: var(--accent-text); }
.tco-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.tco-top { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: 0; }
.tco-title { font-size: 1.05rem; font-weight: 800; color: var(--text); }
.tco-tag { padding: 2px 10px; border-radius: var(--radius-full); background: var(--ds-soft); border: 1px solid var(--border); color: var(--text2); font-size: 0.76rem; font-weight: 700; white-space: nowrap; }
.tco-text { margin: 0; font-size: 0.92rem; line-height: 1.55; color: var(--text2); }
.tp-msg .tco { align-self: center; width: 100%; max-width: 440px; margin: var(--space-2) 0 0; }
@media (max-width: 560px) { .tco { gap: var(--space-3); padding: var(--space-4); } .tco-icon { width: 38px; height: 38px; } }
`;
