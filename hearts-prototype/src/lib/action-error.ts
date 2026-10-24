/** The desk a generic failure should send someone back to. */
export function deskScreenName(path: string) {
  const clean = path.split('?')[0] || '/'
  if (clean.includes('bring-in')) return 'Bring in'
  if (clean.includes('/access') || clean.includes('/codes')) return 'Codes'
  if (clean.includes('/teach')) return 'Teach'
  if (clean.includes('/content')) return 'Content'
  if (clean.includes('/settings')) return 'Settings'
  if (clean.includes('/nights')) return 'Nights'
  if (/\/admin\/?$/.test(clean)) return 'Overview'
  if (clean.startsWith('/master')) return 'Master desk'
  return 'the desk'
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
