import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const TYPOGRAPHY_STYLES = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'] as const
export type TypographyStyle = (typeof TYPOGRAPHY_STYLES)[number]

export const TYPOGRAPHY_LABEL: Record<TypographyStyle, string> = {
  kinetic: 'Kinetic',
  windows: 'Windows',
  conversation: 'Conversation',
  cinema: 'Cinema',
  unfold: 'Unfold',
}

export type TypographyTalkFiles = {
  id: string
  title: string
  speaker: string
  styles: Partial<Record<TypographyStyle, string>>
}

export type TypographyManifest = { talks: TypographyTalkFiles[] }

export function isTypographyStyle(value: string): value is TypographyStyle {
  return (TYPOGRAPHY_STYLES as readonly string[]).includes(value)
}

export function readTypographyManifest(root = process.cwd()): TypographyManifest {
  const file = path.join(root, 'public', 'typography', 'manifest.json')
  if (!existsSync(file)) return { talks: [] }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as TypographyManifest
    return Array.isArray(parsed?.talks) ? parsed : { talks: [] }
  } catch {
    return { talks: [] }
  }
}

export function filesForTalk(manifest: TypographyManifest, youtubeId: string | null | undefined, title: string) {
  const id = (youtubeId || '').trim()
  if (id) {
    const byId = manifest.talks.find((talk) => talk.id === id)
    if (byId) return byId
  }
  const named = title.trim()
  return manifest.talks.find((talk) => talk.title === named) || null
}
