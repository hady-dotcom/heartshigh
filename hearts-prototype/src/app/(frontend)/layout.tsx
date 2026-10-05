import './fonts-local.css'
import './globals.css'
import './app.css'
import './desk.css'
import './compass.css'
import './motion.css'
import './journey.css'
import './garden.css'
import './theme.css'
import './gather.css'
import { themeBootScript } from '@/lib/daypart'
import { installBootScript } from '@/lib/install-prompt'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ViewAsBanner } from '@/components/viewas-banner'
import { SkipLink } from '@/components/app/skip-link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HEARTS',
  description: 'Short clips from real talks, full courses, and a circle that meets in person.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'HEARTS', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0F3B3A',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/cormorant-garamond-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <script dangerouslySetInnerHTML={{ __html: installBootScript() }} />
      </head>
      <body>
        <SkipLink />
        <ViewAsBanner />
        {children}
      </body>
    </html>
  )
}
