/** Clips the learner saved on this phone. Shared by the feed, Me › Saved and the Home count. */

export const SAVED_KEY = 'hearts.saved.v1'
export const FAVES_KEY = 'hearts.faves.v1'

export function parseIdList(raw: string | null | undefined) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

/** Saved keys are `cut-<id>`. The feed opens with `?clip=<id>`. */
export function cutIdFromSaved(id: string) {
  const match = /^cut-(\d+)$/.exec(id)
  if (match) return Number(match[1])
  const numeric = Number(id)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

export function savedHref(base: string, id: string) {
  const cut = cutIdFromSaved(id)
  return cut ? `${base}/feed?clip=${cut}` : `${base}/feed`
}
