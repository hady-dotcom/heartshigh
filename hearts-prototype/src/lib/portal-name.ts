/** The brand word is always written HEARTS on screen. Only the shown name changes; the stored name and the slug stay as typed. */
export function showPortalName(name: unknown): string {
  const text = typeof name === 'string' ? name : name == null ? '' : String(name)
  return text.replace(/\bhearts\b/gi, 'HEARTS')
}

/** The name a portal shows people: the organisation's own name, else the portal name. */
export function portalDisplayName(portal: object | null | undefined): string {
  if (!portal) return ''
  const { organisationName, name } = portal as { organisationName?: unknown; name?: unknown }
  const org = typeof organisationName === 'string' ? organisationName.trim() : ''
  return showPortalName(org || name)
}
