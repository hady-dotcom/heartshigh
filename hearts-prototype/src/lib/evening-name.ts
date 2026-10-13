/** A blank night or circle evening is saved as Circle evening, never as an empty name. */
export function eveningName(typed: string | null | undefined) {
  const name = String(typed || '').replace(/\s+/g, ' ').trim()
  if (name) return name.slice(0, 120)
  return 'Circle evening'
}
