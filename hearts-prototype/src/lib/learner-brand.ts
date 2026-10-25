/** Colours and name for a branded sequence portal. HEARTS portals stay unmarked. */
export function learnerBrand(portal: { shape?: string | null; brandName?: string | null; colour?: string | null; accent?: string | null } | null | undefined) {
  const name = String(portal?.brandName || '').trim()
  if (!portal || portal.shape !== 'sequence' || !name) return undefined
  return { colour: String(portal.colour || '#1f3a5f'), accent: String(portal.accent || '#e07a5f'), name }
}
