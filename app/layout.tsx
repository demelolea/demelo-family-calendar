import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import PwaInit from '@/components/PwaInit'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})

export const metadata: Metadata = {
  title:       'De Melo',
  description: 'The De Melo family calendar',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'default',
    title:           'DeMelo',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor:   '#44403C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="antialiased bg-[#FAF8F3] text-stone-800">
        {children}
        <PwaInit />
      </body>
    </html>
  )
}
