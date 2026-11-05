/**
 * Each experiment slot maps to one learner screen and the element that changes.
 * The desk mock draws Version A and Version B from the real variant words.
 */
import { formatSlotLabel, variantCopy } from './experiment-slots'

export type MockKind = 'feed-button' | 'talk-button' | 'lanes-tab' | 'video-frame'

export type MockTarget = {
  slot: string
  screen: string
  element: string
  /** Short label that sits with the arrow. */
  callout: string
  kind: MockKind
}

export type MockFace = { key: string; letter: string; text: string }

const TARGETS: Record<string, MockTarget> = {
  'feed-cta-label': {
    slot: 'feed-cta-label',
    screen: 'The feed',
    element: 'The button under the clip',
    callout: 'This button changes',
    kind: 'feed-button',
  },
  'full-talk-cta-label': {
    slot: 'full-talk-cta-label',
    screen: 'The short cut',
    element: 'The button into the whole talk',
    callout: 'This button changes',
    kind: 'talk-button',
  },
  'lanes-tab-label': {
    slot: 'lanes-tab-label',
    screen: 'Courses',
    element: 'The courses tab',
    callout: 'This tab changes',
    kind: 'lanes-tab',
  },
  'wide-video-framing': {
    slot: 'wide-video-framing',
    screen: 'The clip',
    element: 'How the picture is framed',
    callout: 'This frame changes',
    kind: 'video-frame',
  },
}

export function mockTarget(slot: string | null | undefined): MockTarget {
  if (slot && TARGETS[slot]) return TARGETS[slot]
  return {
    slot: slot || 'unknown',
    screen: 'The learner screen',
    element: 'The part under test',
    callout: 'This part changes',
    kind: 'feed-button',
  }
}

/** The first two versions, side by side, using the words learners would see. */
export function mockFaces(variants: { key?: string | null; label?: string | null; payload?: unknown }[] | null | undefined): MockFace[] {
  return (variants || [])
    .filter((row) => String(row?.key || '').trim())
    .slice(0, 2)
    .map((row, index) => ({
      key: String(row.key),
      letter: String.fromCharCode(65 + index),
      text: variantCopy(row.payload, String(row.label || '')),
    }))
}

/** Fill {n} for a talk length so the mock shows a real button line. */
export function mockLine(text: string, kind: MockKind) {
  if (kind === 'video-frame') return text.trim() || 'face-crop'
  return formatSlotLabel(text, 18) || text
}

/**
 * Copy edited version lines onto the matching faces.
 * Returns the same array when nothing changed, so a live preview can poll safely.
 */
export function applyLiveLabels(faces: MockFace[], values: Record<string, string>): MockFace[] {
  let changed = false
  const next = faces.map((face) => {
    const value = values[face.key]
    if (value == null || value === face.text) return face
    changed = true
    return { ...face, text: value }
  })
  return changed ? next : faces
}
