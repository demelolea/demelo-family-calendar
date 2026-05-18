import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

function iconJsx(size: number) {
  const radius = Math.round(size * 0.18)
  const dogW   = Math.round(size * 0.72)
  const dogH   = Math.round(size * 0.36)
  const textSz = Math.round(size * 0.12)
  const gap    = Math.round(size * 0.04)

  return (
    <div
      style={{
        width: size, height: size,
        background: 'linear-gradient(145deg, #57534E 0%, #292524 100%)',
        borderRadius: radius,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap,
      }}
    >
      <svg viewBox="0 0 52 26" width={dogW} height={dogH} fill="#FAF8F3">
        <ellipse cx="24" cy="17" rx="16" ry="6.5" />
        <ellipse cx="38" cy="12" rx="8"  ry="6.5" />
        <ellipse cx="45.5" cy="14.5" rx="3.5" ry="2.8" />
        <ellipse cx="34" cy="7" rx="4.5" ry="6" transform="rotate(-8 34 7)" />
        <path d="M8 14 Q2 10 3 5 Q6 1 10 5" stroke="#FAF8F3" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <rect x="15" y="21" width="3" height="5" rx="1.5" />
        <rect x="21" y="21" width="3" height="5" rx="1.5" />
        <rect x="28" y="21" width="3" height="5" rx="1.5" />
        <rect x="34" y="21" width="3" height="5" rx="1.5" />
      </svg>
      <div style={{
        color: '#D6D3D1',
        fontSize: textSz,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        letterSpacing: textSz * 0.18,
      }}>
        DE MELO
      </div>
    </div>
  )
}

export function GET(request: NextRequest) {
  const sizeParam = request.nextUrl.searchParams.get('size')
  const size      = Math.min(512, Math.max(32, parseInt(sizeParam ?? '192')))

  return new ImageResponse(iconJsx(size), { width: size, height: size })
}
