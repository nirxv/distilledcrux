'use client';

export default function HistoryMarquee() {
  const text = 'For History Optional → visit historyoptional.xyz';
  // Repeat enough times to fill any screen width
  const items = Array(12).fill(text);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 200,
      background: 'rgba(5,5,8,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(67,97,238,0.25)',
      overflow: 'hidden',
      height: 34,
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        whiteSpace: 'nowrap',
        animation: 'marquee-scroll 28s linear infinite',
        willChange: 'transform',
      }}>
        {items.map((t, i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            letterSpacing: '0.04em',
            color: 'var(--text2)',
            paddingRight: '3.5rem',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>History Optional?</span>
            {' '}Visit{' '}
            <a
              href="https://historyoptional.xyz"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent3)',
                fontWeight: 600,
                textDecoration: 'none',
                borderBottom: '1px solid rgba(123,147,247,0.35)',
              }}
            >
              historyoptional.xyz
            </a>
            <span style={{ color: 'var(--text3)', marginLeft: '3rem' }}>✦</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
