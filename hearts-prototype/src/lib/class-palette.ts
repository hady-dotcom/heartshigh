/** Garden colours a class can wear. Cream type on each of these meets 4.5:1. */

export const CLASS_COLOURS = [
  { label: 'Deep teal', value: '#0E2A2B' },
  { label: 'Garden', value: '#163633' },
  { label: 'Lantern teal', value: '#1A5552' },
  { label: 'Warm gold', value: '#8A6A1F' },
  { label: 'Dusk', value: '#1A1408' },
] as const

export type ClassColour = (typeof CLASS_COLOURS)[number]['value']

export function classColour(value?: string | null) {
  const found = CLASS_COLOURS.find((row) => row.value === value)
  return found?.value || CLASS_COLOURS[0].value
}

export function classColourLabel(value?: string | null) {
  return CLASS_COLOURS.find((row) => row.value === value)?.label || CLASS_COLOURS[0].label
}
