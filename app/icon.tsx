import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32, height: 32,
        background: '#44403C',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FAF8F3',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        fontFamily: 'sans-serif',
      }}
    >
      DM
    </div>,
    { ...size },
  )
}
