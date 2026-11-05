/** Seconds from a length field: empty, a number of seconds, or minutes:seconds (or hours:minutes:seconds). */
export function parseLengthInput(raw: string): { ok: true; seconds?: number } | { ok: false; message: string } {
  const text = raw.trim()
  if (!text) return { ok: true, seconds: undefined }
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(text)) {
    return { ok: false, message: 'Use seconds (90) or minutes:seconds (1:30).' }
  }
  const parts = text.split(':')
  if (parts.slice(1).some((part) => Number(part) >= 60)) {
    return { ok: false, message: 'Minutes and seconds stay under 60.' }
  }
  return { ok: true, seconds: parts.reduce((total, part) => total * 60 + Number(part), 0) }
}
