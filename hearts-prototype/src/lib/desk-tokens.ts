/**
 * Shared desk tokens — white canvas and blue accent.
 * Same hex values as the --desk-* custom properties in theme.css.
 * Cream is no longer the page colour. Floating help tips use the paper token.
 */

export const deskTokens = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  ink: '#111827',
  heading: '#111827',
  sidebar: '#F3F4F6',
  header: '#FFFFFF',
  onDark: '#111827',
  gold: '#2563EB',
  goldInk: '#FFFFFF',
  teal: '#1D4ED8',
  muted: '#4B5563',
  line: '#E5E7EB',
  field: '#F3F4F6',
} as const

function channel(value: number) {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string) {
  const n = hex.replace('#', '')
  const r = Number.parseInt(n.slice(0, 2), 16)
  const g = Number.parseInt(n.slice(2, 4), 16)
  const b = Number.parseInt(n.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
