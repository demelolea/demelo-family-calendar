import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180, height: 180,
        background: 'linear-gradient(145deg, #57534E 0%, #292524 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {/* Dachshund silhouette — simplified paths via SVG */}
      <svg
        viewBox="0 0 52 26"
        width="90"
        height="45"
        fill="#FAF8F3"
      >
        <ellipse cx="24" cy="17" rx="16" ry="6.5" />
        <ellipse cx="38" cy="12" rx="8" ry="6.5" />
        <ellipse cx="45.5" cy="14.5" rx="3.5" ry="2.8" />
        <ellipse cx="34" cy="7" rx="4.5" ry="6" transform="rotate(-8 34 7)" />
        <path d="M8 14 Q2 10 3 5 Q6 1 10 5" stroke="#FAF8F3" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <rect x="15" y="21" width="3" height="5" rx="1.5" />
        <rect x="21" y="21" width="3" height="5" rx="1.5" />
        <rect x="28" y="21" width="3" height="5" rx="1.5" />
        <rect x="34" y="21" width="3" height="5" rx="1.5" />
      </svg>
      <div
        style={{
          color: '#D6D3D1',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}
      >
        DE MELO
      </div>
    </div>,
    { ...size },
  )
}
