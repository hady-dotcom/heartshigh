// Small line drawings for the scene tiles. Purely decorative: every tile also carries its words.

const paths: Record<string, string[]> = {
  treat: ['M6 9h12l-1 11H7z', 'M9 9V7a3 3 0 0 1 6 0v2'],
  tuck: ['M7 7h10v13H7z', 'M6 4h12v3H6z', 'M10 12h4'],
  'pass-on': ['M3 14c3 0 5 2 7 2h4a2 2 0 0 0 0-4h-3', 'M3 19h12l6-5', 'M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4'],
  pause: ['M5 11h12v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z', 'M17 12h2a2 2 0 0 1 0 4h-2', 'M9 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4'],
  look: ['M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z', 'M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4', 'M6 5l3 2M18 5l-3 2'],
  polite: ['M4 6h16v9H9l-5 4z', 'M8 10h8'],
  'let-go': ['M12 20V9', 'M8 13l4-4 4 4', 'M5 5c2 1 4 1 7 0s5-1 7 0'],
  replay: ['M4 12a8 8 0 1 0 3-6.2', 'M4 4v4h4', 'M12 8v4l3 2'],
  'one-more': ['M7 3h10v18H7z', 'M10 9l4 3-4 3z'],
  lives: ['M4 5h16v14H4z', 'M4 15l5-4 4 3 3-2 4 3', 'M15 9h.01'],
  off: ['M18 14A7 7 0 1 1 10 6a5.5 5.5 0 0 0 8 8z'],
  talk: ['M4 6c3-1 6-1 8 1v12c-2-2-5-2-8-1z', 'M20 6c-3-1-6-1-8 1v12c2-2 5-2 8-1z'],
  phone: ['M8 3h8v18H8z', 'M11 18h2'],
  person: ['M4 6h12v8H9l-4 3v-3H4z', 'M18 9h2v8h-1v3l-3-3h-4'],
  wudu: ['M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z', 'M4 21h16'],
  spin: ['M12 4a8 8 0 1 1-8 8', 'M12 8a4 4 0 1 1-4 4', 'M12 12h.01'],
  heavy: ['M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z'],
}

export function Glyph({ name, size = 30 }: { name: string; size?: number }) {
  const lines = paths[name]
  if (!lines) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export const BUBBLE_TINTS = ['#f0b44c', '#e98fb0', '#7fc4a8', '#a98bd6', '#6fa8dc']
export const DOOR_TINTS = [
  ['#2f6f73', '#7fc4a8'],
  ['#8a4b2b', '#f0b44c'],
  ['#3d3a7a', '#a98bd6'],
  ['#7a2f45', '#e98fb0'],
  ['#2b4f7a', '#6fa8dc'],
  ['#6b5a2a', '#e8cf8a'],
]
