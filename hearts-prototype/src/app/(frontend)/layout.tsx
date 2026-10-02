import './globals.css'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'HEARTS', description: 'A gentle path into a living curriculum.' }

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;560;650&family=Fraunces:opsz,wght@9..144,500;9..144,620&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
