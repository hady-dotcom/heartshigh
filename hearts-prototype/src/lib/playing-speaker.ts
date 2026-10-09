import { stripSpeakerHonorific } from './speakers'

/**
 * The name on the More board is the playing lesson's speaker.
 * A course speaker, a lane speaker, or the fallback "The speaker" must not stand in.
 * Titles are stripped so "Shaykh Yasir Fahmy" and "Yasir Fahmy" read as one name.
 */
export function playingSpeaker(lessonSpeaker: unknown) {
  const name = stripSpeakerHonorific(String(lessonSpeaker || ''))
  if (!name || /^the speaker$/i.test(name)) return ''
  return name
}
