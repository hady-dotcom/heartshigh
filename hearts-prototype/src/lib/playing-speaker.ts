/**
 * The name on the More board is the playing lesson's speaker.
 * A course speaker, a lane speaker, or the fallback "The speaker" must not stand in.
 */
export function playingSpeaker(lessonSpeaker: unknown) {
  const name = String(lessonSpeaker || '').trim()
  if (!name || /^the speaker$/i.test(name)) return ''
  return name
}
