import type { SceneDef, SceneOption } from './heart'
import { authorTextProblems } from './opening-data'

export type PortalSceneDraft = {
  key?: string
  caption?: string
  subline?: string
  options?: { key?: string; label?: string; replyPill?: string }[]
}

const KEY = /^[a-z][a-z0-9-]{1,40}$/

function slugKey(text: string, fallback: string) {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return KEY.test(slug) ? slug : fallback
}

export function cleanPortalScenes(value: unknown, existingKeys: Set<string> = new Set()): { scenes: SceneDef[]; error?: string } {
  if (value == null) return { scenes: [] }
  if (!Array.isArray(value)) return { scenes: [], error: 'Those questions could not be read.' }
  const scenes: SceneDef[] = []
  const used = new Set(existingKeys)
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== 'object') continue
    const draft = row as PortalSceneDraft
    const caption = String(draft.caption || '').trim().slice(0, 140)
    const subline = String(draft.subline || '').trim().slice(0, 200)
    const rawOptions = Array.isArray(draft.options) ? draft.options : []
    const options: SceneOption[] = []
    for (const [optionIndex, option] of rawOptions.entries()) {
      const label = String(option?.label || '').trim().slice(0, 80)
      if (!label) continue
      const key = slugKey(String(option?.key || label), `opt-${optionIndex + 1}`)
      options.push({
        key,
        label,
        replyPill: String(option?.replyPill || '').trim().slice(0, 80) || undefined,
        nudges: [],
      })
    }
    if (!caption || options.length < 2) continue
    if (options.length > 6) return { scenes: [], error: 'A question can have at most six answers.' }
    let key = slugKey(String(draft.key || caption), `portal-${index + 1}`)
    if (used.has(key)) key = `${key}-${index + 1}`
    used.add(key)
    const author = authorTextProblems([
      ['Caption', caption],
      ['Second line', subline],
      ...options.map((option): [string, string] => ['Answer', option.label]),
    ])
    if (author.length) return { scenes: [], error: author[0] }
    scenes.push({
      key,
      order: 100 + index + 1,
      layout: 'grid4',
      caption,
      subline,
      options,
    })
  }
  return { scenes }
}

export function portalSceneFromForm(form: {
  key?: string
  caption: string
  subline?: string
  labels: string[]
  existing: SceneDef[]
}) {
  const labels = form.labels.map((label) => label.trim()).filter(Boolean)
  return cleanPortalScenes(
    [
      ...form.existing,
      {
        key: form.key,
        caption: form.caption,
        subline: form.subline,
        options: labels.map((label, index) => ({ key: `opt-${index + 1}`, label })),
      },
    ],
    new Set(),
  )
}
