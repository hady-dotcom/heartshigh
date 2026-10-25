/** Colours and name when a portal has set the name people see. An empty name keeps HEARTS. */
export function learnerBrand(portal: { brandName?: string | null; colour?: string | null; accent?: string | null } | null | undefined) {
  const name = String(portal?.brandName || '').trim()
  if (!portal || !name) return undefined
  return { colour: String(portal.colour || '#1f3a5f'), accent: String(portal.accent || '#e07a5f'), name }
}

/** A logo saved on the portal: a site path such as /icons/hady-home.svg, or an https link. */
export function portalLogo(value: unknown) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}
