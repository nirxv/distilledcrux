import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  const font = await fetch(
    new URL('/fonts/fonnts.com-Neue_Haas_Grotesk_Display_Pro_95_Black.otf', 'https://distilledcrux.com')
  ).then((res) => res.arrayBuffer());

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
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.04em',
            fontFamily: 'Neue Haas Grotesk',
            lineHeight: 1,
          }}
        >
          DC
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Neue Haas Grotesk',
          data: font,
          weight: 900,
          style: 'normal',
        },
      ],
    }
  );
}
