import './globals.css'
import './app.css'
import './desk.css'
import './motion.css'
import './journey.css'
import './theme.css'
import { themeBootScript } from '@/lib/daypart'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ViewAsBanner } from '@/components/viewas-banner'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HEARTS',
  description: 'Short clips from real talks, full courses, and a circle that meets in person.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'HEARTS', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f0e4',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700;800&family=Libre+Caslon+Text:wght@400;700&family=Noto+Naskh+Arabic:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ViewAsBanner />
        {children}
      </body>
    </html>
  )
}
