/** Display serif used on learner and desk headings. Must match the self-hosted @font-face. */
export const DISPLAY_FONT = 'Cormorant Garamond'
export const BODY_FONT = 'Inter'

export function displayFontLoaded(fonts: { check: (font: string) => boolean }) {
  return fonts.check(`600 32px "${DISPLAY_FONT}"`)
}
