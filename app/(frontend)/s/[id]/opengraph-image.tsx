import { ImageResponse } from 'next/og';
import { loadSharedCheck } from '@/lib/sharedCheck';

/**
 * The preview WhatsApp and Telegram show for a shared answer check: the
 * score and the marks for each part. Latin text and digits only, so the
 * default font covers it; the question goes in the preview's text, which the
 * app renders in any script.
 */
export const alt = 'An answer check on Distilled Crux';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Rendered once a day at most per card, and a stopped share drops out within that.
export const revalidate = 86400;
export async function generateStaticParams() {
  return [];
}

const INK = '#1c1b1f', MUTED = '#6b6a70', PAPER = '#fbfaf7', TRACK = '#e9e6de', ACCENT = '#4361ee';
const tone = (p: number) => (p >= 0.7 ? '#1f7a4d' : p >= 0.5 ? '#a15c07' : '#b42318');
const NAMES = { introduction: 'Introduction', body: 'Body', conclusion: 'Conclusion', presentation: 'Presentation' } as const;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await loadSharedCheck(id);
  const pct = check?.outOf ? check.marks / check.outOf : 0;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, padding: '64px 72px', color: INK }}>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, letterSpacing: 2, color: MUTED }}>{check ? `UPSC ${check.subject.toUpperCase()} ANSWER CHECK` : 'UPSC MAINS ANSWER CHECK'}</div>
        {check ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 72 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: 380 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', color: tone(pct) }}>
                <span style={{ fontSize: 168, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>{check.marks}</span>
                <span style={{ fontSize: 56, fontWeight: 600, color: MUTED, marginLeft: 12 }}>/ {check.outOf}</span>
              </div>
              <div style={{ display: 'flex', height: 14, marginTop: 24, borderRadius: 7, background: TRACK }}>
                <div style={{ display: 'flex', width: `${Math.min(100, pct * 100)}%`, height: 14, borderRadius: 7, background: tone(pct) }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 26 }}>
              {check.sections.map((s) => {
                const p = s.outOf ? s.awarded / s.outOf : 0;
                return (
                  <div key={s.key} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, color: INK }}>
                      <span>{NAMES[s.key]}</span><span style={{ color: MUTED }}>{s.awarded} / {s.outOf}</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, marginTop: 10, borderRadius: 5, background: TRACK }}>
                      <div style={{ display: 'flex', width: `${Math.min(100, p * 100)}%`, height: 10, borderRadius: 5, background: tone(p) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', fontSize: 64, fontWeight: 800 }}>Get your answer checked</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: INK }}>Distilled Crux</span>
          <span style={{ fontSize: 28, color: ACCENT }}>distilledcrux.com</span>
        </div>
      </div>
    ),
    size,
  );
}
