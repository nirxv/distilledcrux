import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#050508',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: '#4361ee',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            fontFamily: 'serif',
            lineHeight: 1,
          }}
        >
          dc.
        </span>
      </div>
    ),
    { ...size }
  );
}
