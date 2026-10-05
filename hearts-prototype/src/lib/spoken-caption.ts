import { tidyCaption } from './tidy-caption'

export function foldCaption(value: string) {
  return value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** The words said at this moment. A talk title, series name or empty line is not a caption. */
export function spokenCaption(line: { text?: string; tidy?: string } | null | undefined, titles: (string | undefined)[]) {
  const shown = tidyCaption((line?.tidy || line?.text || '').trim())
  if (!shown) return ''
  const spoken = foldCaption(shown)
  if (titles.some((title) => title && spoken === foldCaption(title))) return ''
  return shown
}
