/**
 * Shared desk tokens — evening garden.
 * Deep teal page and panels, warm dark gold, cream type. Cream is for floating cards (help tips), not the page.
 * Keep these hex values identical to the --desk-* custom properties in theme.css.
 */

export const deskTokens = {
  page: '#0E2A2B',
  card: '#163633',
  ink: '#F6EEDC',
  heading: '#F6EEDC',
  sidebar: '#0B2223',
  header: '#0F3B3A',
  onDark: '#F6EEDC',
  gold: '#D4A84B',
  goldInk: '#1A1408',
  teal: '#1A5552',
  muted: '#E4D3A4',
  line: '#C4923A',
  field: '#102E2C',
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
