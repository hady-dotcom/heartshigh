import manifestJson from './see-how-manifest.json'

export type SeeHowCaption = { start: number; end: number; text: string }

export type SeeHowPage = {
  title: string
  video: string
  poster: string
  captions: SeeHowCaption[]
  /**
   * When set, the player uses this URL instead of `video`.
   * An admin upload can write the path here, or set the same page id in
   * `/see-how/overrides.json` (that file wins, so a later upload need not
   * regenerate the filmed demos).
   */
  overrideVideo: string
  seconds?: number
}

export type SeeHowManifest = {
  pages: Record<string, SeeHowPage>
  keys: Record<string, string>
  skipped: Record<string, string>
}

export const seeHowManifest = manifestJson as SeeHowManifest

/** The filmed page for a help key, or null when that key has no demo yet. */
export function seeHowFor(key?: string | null): (SeeHowPage & { id: string }) | null {
  if (!key) return null
  const id = seeHowManifest.keys[key]
  if (!id) return null
  const page = seeHowManifest.pages[id]
  if (!page?.video) return null
  return { ...page, id }
}

export function seeHowCaptionAt(page: SeeHowPage, seconds: number) {
  const hit = page.captions.find((row) => seconds >= row.start && seconds < row.end)
  return hit?.text || page.captions[page.captions.length - 1]?.text || ''
}
