/** A date an admin can read. A value that is not a date is left as written. Stored values are not changed. */
export function humanDate(value: string | undefined | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
