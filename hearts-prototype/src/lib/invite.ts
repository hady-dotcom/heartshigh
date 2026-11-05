/** The join card names the person who invited them, when we have one, else the portal. */

export function inviteLine(portal: string, person?: string | null) {
  const place = (portal || '').replace(/\s+/g, ' ').trim() || 'Someone in your circle'
  const name = (person || '').replace(/\s+/g, ' ').trim().split(' ')[0] || ''
  if (name) return `${name} from ${place} invited you`
  return `${place} invited you`
}

export function firstNameOf(name?: string | null) {
  return (name || '').replace(/\s+/g, ' ').trim().split(' ')[0] || ''
}
