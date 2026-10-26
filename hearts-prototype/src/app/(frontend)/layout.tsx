import './tokens.css'
import './a11y.css'
import './globals.css'
import './app.css'
import './desk.css'
import './compass.css'
import './motion.css'
import './journey.css'
import './garden.css'
import './theme.css'
import './shell-modern.css'
import './gather.css'
import './live.css'
import './framing.css'
import { themeBootScript } from '@/lib/daypart'
import { installBootScript } from '@/lib/install-prompt'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { StageFrameGuard } from '@/components/stage-frame-guard'
import { ViewAsBanner } from '@/components/viewas-banner'

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
  themeColor: '#F2F2F7',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" data-theme="evening" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <script dangerouslySetInnerHTML={{ __html: installBootScript() }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin-400-normal.woff2" crossOrigin="" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/plus-jakarta-sans-latin-700-normal.woff2" crossOrigin="" />
        {/* Printed first so the sheet does not block the first paint, then applied on load. */}
        <link
          id="hh-google-fonts"
          rel="stylesheet"
          media="print"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700;800&family=Libre+Caslon+Text:wght@400;700&family=Noto+Naskh+Arabic:wght@500;600&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.getElementById('hh-google-fonts');if(!l)return;l.onload=function(){this.media='all'}})();`,
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700;800&family=Libre+Caslon+Text:wght@400;700&family=Noto+Naskh+Arabic:wght@500;600&display=swap"
          />
        </noscript>
      </head>
      <body suppressHydrationWarning>
        <StageFrameGuard />
        <ViewAsBanner />
        {children}
      </body>
    </html>
  )
}
