import { NextResponse } from 'next/server'
import { APIError } from 'payload'
import { authorTextProblems } from '@/lib/opening-data'
import { SCALE_KEYS } from '@/lib/heart'
import type { PersonaSource, RangeRow } from '@/lib/persona'
import { hasMarkup } from '@/lib/text-safety'
import { getSession } from '@/server/context'
import { blocked } from '@/server/viewas'

export const dynamic = 'force-dynamic'

const ROOMS = new Set(['appetites', 'heat', 'unsettled', 'lights'])
const SEASONS = new Set(['youth', 'health', 'wealth', 'freeTime', 'life'])
const SOURCES = new Set<PersonaSource>(['doc-a', 'doc-b', 'doc-c', 'ux-draft', 'unassigned', 'balanced'])

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 500))
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function readable(error: unknown) {
  if (error instanceof APIError && error.message) return error.message
  if (error instanceof Error && error.message && error.message.length < 500) return error.message
  return 'That could not be saved.'
}

/** Whole number from −10 to +10, or null when the box is empty. */
function rung(raw: string, scale: string) {
  if (!raw) return { value: null as number | null, problem: '' }
  if (!/^-?\d+$/.test(raw)) return { value: null, problem: `${scale} needs a whole number.` }
  const value = Number(raw)
  if (value < -10 || value > 10) return { value: null, problem: `${scale} stays between −10 and +10.` }
  return { value, problem: '' }
}

function rangesFrom(form: FormData) {
  const ranges: RangeRow[] = []
  for (const scale of SCALE_KEYS) {
    const present = form.get(`present-${scale}`) === 'on'
    const low = rung(text(form, `min-${scale}`), scale)
    const high = rung(text(form, `max-${scale}`), scale)
    if (low.problem) return { ranges, problem: low.problem }
    if (high.problem) return { ranges, problem: high.problem }
    if (low.value != null && high.value != null && low.value > high.value) return { ranges, problem: `${scale}: the low end is above the high end.` }
    ranges.push({ scale, present, min: low.value, max: high.value })
  }
  return { ranges, problem: '' }
}

function anchorsFrom(raw: string) {
  const anchors: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(-?\d+)\s*:\s*(.+)$/)
    if (!match) return { anchors: null, problem: 'Each anchor is a line like “-2: struggles to forgive”.' }
    const parsed = rung(match[1], 'An anchor')
    if (parsed.problem || parsed.value == null) return { anchors: null, problem: parsed.problem || 'An anchor needs a rung.' }
    if (hasMarkup(match[2])) return { anchors: null, problem: 'Anchor text is plain text.' }
    anchors[String(parsed.value)] = match[2].trim()
  }
  return { anchors, problem: '' }
}

/** Master desk edits for scales, scene nudges and persona bands. Learners never post here. */
export async function POST(req: Request) {
  const session = await getSession()
  const form = await req.formData().catch(() => null)
  const next = form ? text(form, 'next') || '/master/personas' : '/master/personas'
  if (!form) return redirectTo(req, next, 'Nothing was sent.')
  if (session.actor?.role !== 'master') return redirectTo(req, next, 'Only the master desk edits these.')
  if (session.viewAs) {
    await blocked(session.payload, session.viewAs, { route: 'persona-desk', never: !session.viewAs.writeEnabled })
    if (!session.viewAs.writeEnabled) return redirectTo(req, next, 'Read-only while viewing as someone else.')
  }
  const { payload } = session
  const action = text(form, 'action')

  try {
    if (action === 'scale') {
      const id = Number(text(form, 'scale'))
      const existing = await payload.findByID({ collection: 'heart-scales', id, overrideAccess: true, depth: 0 }).catch(() => null)
      if (!existing) return redirectTo(req, next, 'That scale was not found.')
      const leonName = text(form, 'leonName')
      if (!leonName) return redirectTo(req, next, 'A scale needs its name.')
      if (hasMarkup(leonName)) return redirectTo(req, next, 'The scale name is plain text.')
      const polishLabel = text(form, 'polishLabel')
      const focusName = text(form, 'focusName')
      const wording = authorTextProblems([['The learner-safe name', polishLabel], ['The focus word', focusName]])
      if (wording.length) return redirectTo(req, next, wording[0])
      const room = text(form, 'room')
      if (room && !ROOMS.has(room)) return redirectTo(req, next, 'That room is not one of the four.')
      const season = text(form, 'season')
      if (season && !SEASONS.has(season)) return redirectTo(req, next, 'That season is not in the list.')
      const parsed = anchorsFrom(String(form.get('anchors') || ''))
      if (parsed.problem) return redirectTo(req, next, parsed.problem)
      await payload.update({
        collection: 'heart-scales',
        id,
        overrideAccess: true,
        data: {
          leonName,
          polishLabel,
          focusName,
          room: room || null,
          season: season || null,
          firstOpenRead: form.get('firstOpenRead') === 'on',
          anchors: parsed.anchors,
        } as never,
      })
      return redirectTo(req, next, undefined, 'Scale saved.')
    }

    if (action === 'nudges') {
      const id = Number(text(form, 'scene'))
      const scene = await payload.findByID({ collection: 'opening-scenes', id, overrideAccess: true, depth: 0 }).catch(() => null)
      if (!scene) return redirectTo(req, next, 'That scene was not found.')
      const options = ((scene as { options?: { key?: string; nudges?: { scale?: string; delta?: number }[] }[] }).options || []).map((option) => ({
        ...option,
        nudges: (option.nudges || []).map((nudge) => {
          const raw = text(form, `d__${option.key}__${nudge.scale}`)
          if (!raw) return nudge
          const delta = Number(raw)
          if (delta !== -1 && delta !== 0 && delta !== 1) throw new APIError(`${option.key} needs a nudge of −1, 0 or +1.`, 400, null, true)
          return { ...nudge, delta }
        }),
      }))
      await payload.update({ collection: 'opening-scenes', id, overrideAccess: true, data: { options } as never })
      return redirectTo(req, next, undefined, 'Nudges saved.')
    }

    if (action === 'band') {
      const id = Number(text(form, 'band'))
      const existing = await payload.findByID({ collection: 'persona-bands', id, overrideAccess: true, depth: 0 } as never).catch(() => null)
      if (!existing) return redirectTo(req, next, 'That band was not found.')
      const title = text(form, 'title')
      const note = text(form, 'note')
      if (!title) return redirectTo(req, next, 'A band needs a name.')
      if (hasMarkup(title) || hasMarkup(note)) return redirectTo(req, next, 'Plain text only.')
      const source = text(form, 'source')
      if (!SOURCES.has(source as PersonaSource)) return redirectTo(req, next, 'That source is not in the list.')
      const parsed = rangesFrom(form)
      if (parsed.problem) return redirectTo(req, next, parsed.problem)
      const status = text(form, 'status') === 'published' ? 'published' : 'draft'
      await payload.update({
        collection: 'persona-bands',
        id,
        overrideAccess: true,
        data: {
          title,
          note,
          source,
          status,
          placeholder: form.get('placeholder') === 'on',
          ranges: parsed.ranges.map((row) => ({ scale: row.scale, present: row.present, min: row.min, max: row.max })),
        },
      } as never)
      return redirectTo(req, next, undefined, status === 'published' ? 'Band published.' : 'Band saved as a draft.')
    }

    if (action === 'copy') {
      const frame = text(form, 'frame')
      if (frame !== 'both' && frame !== 'focusing' && frame !== 'places') return redirectTo(req, next, 'That framing is not in the list.')
      const places = (['growing', 'steady', 'flourishing'] as const).map((key) => ({
        key,
        label: text(form, `label-${key}`),
        low: Number(text(form, `low-${key}`)),
        high: Number(text(form, `high-${key}`)),
        forward: text(form, `forward-${key}`),
      }))
      if (places.some((place) => !place.label || !Number.isInteger(place.low) || !Number.isInteger(place.high))) return redirectTo(req, next, 'Each place needs a word and a whole-number range.')
      const existing = await payload.find({ collection: 'compass-settings', overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: 'default' } } })
      const data = {
        key: 'default',
        frame,
        focusLead: text(form, 'focusLead'),
        movementUp: text(form, 'movementUp'),
        movementSame: text(form, 'movementSame'),
        movementOnward: text(form, 'movementOnward'),
        places,
      }
      if (existing.docs[0]) await payload.update({ collection: 'compass-settings', id: existing.docs[0].id, overrideAccess: true, data: data as never })
      else await payload.create({ collection: 'compass-settings', overrideAccess: true, data: data as never })
      return redirectTo(req, next, undefined, 'Wording saved.')
    }
  } catch (error) {
    return redirectTo(req, next, readable(error))
  }

  return redirectTo(req, next, 'That action is not known.')
}
