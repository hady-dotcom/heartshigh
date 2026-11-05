// A transcript that does not fit in a sheet cell. The file is plain text (or captions) and is copied onto the talk.

export const TRANSCRIPT_FILE_MAX = 500_000

export function transcriptFromFile(bytes: Buffer): { ok: true; text: string } | { ok: false; message: string } {
  if (!bytes.length) return { ok: false, message: 'That transcript file is empty.' }
  if (bytes.includes(0)) return { ok: false, message: 'That file is not a transcript. Upload a text or captions file, such as .txt or .vtt.' }
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '')
  if (!text.trim()) return { ok: false, message: 'That transcript file is empty.' }
  if (text.length > TRANSCRIPT_FILE_MAX) return { ok: false, message: `That transcript is ${text.length.toLocaleString('en-GB')} characters. Keep the file under ${TRANSCRIPT_FILE_MAX.toLocaleString('en-GB')}.` }
  return { ok: true, text }
}

export function transcriptFileKind(kind: string, mime: string, filename: string) {
  if (kind === 'transcript') return true
  if (kind !== 'file') return false
  return /^text\//i.test(mime) || /\.(txt|vtt|srt|md|markdown)$/i.test(filename)
}
