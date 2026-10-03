// Turns a creator request into a draft master sheet. The workbook is the same one the importer already previews.
import type { Payload } from 'payload'
import { buildWorkbook } from '@/lib/master-sheet'
import { draftTalk, transcriptFixture, type DraftSource } from '@/lib/sheet-draft'
import { transcriptFor } from '@/lib/youtube'
import type { SheetScope } from './master-sheet'

export type CreatorSource = {
  provider: 'youtube' | 'vimeo' | 'file'
  id?: string
  title?: string
  speaker?: string
  channel?: string
  durationSeconds?: number | null
  mediaId?: number | null
  transcript?: string | null
}

async function captionsFor(source: CreatorSource, id: string): Promise<string | null> {
  if (source.transcript) return source.transcript
  if (source.provider !== 'youtube') return null
  if (process.env.HEARTS_TRANSCRIPT_FIXTURE) return transcriptFixture(id)
  const found = await transcriptFor(id)
  return found.transcript
}

export async function draftWorkbook(payload: Payload, scope: SheetScope, input: { topic: string; course: string; part: string; sources: CreatorSource[] }) {
  const seats = await payload.find({ collection: 'seats', overrideAccess: true, depth: 1, limit: 200 })
  const shelf = seats.docs.map((seat) => {
    const clause = seat.clause as { number?: number } | number | null
    const number = typeof clause === 'object' && clause ? Number(clause.number || 0) : 0
    return { clause: number, position: Number(seat.position || 0) }
  }).filter((seat) => seat.clause && seat.position)
  const talks: Record<string, string | number | null>[] = []
  const questions: Record<string, string | number | null>[] = []
  const resources: Record<string, string | number | null>[] = []
  let order = 1
  for (const source of input.sources) {
    const id = String(source.id || source.mediaId || '').trim()
    if (!id && source.provider !== 'file') continue
    const transcript = await captionsFor(source, id)
    const drafted = draftTalk({
      provider: source.provider,
      id: id || String(source.mediaId || ''),
      title: source.title || 'Untitled film',
      speaker: source.speaker,
      channel: source.channel,
      durationSeconds: source.durationSeconds,
      mediaId: source.mediaId,
      transcript,
    } satisfies DraftSource, {
      topic: input.topic,
      course: input.course,
      part: input.part || 'Talks',
      order: order++,
      seats: shelf,
    })
    talks.push(drafted.talk)
    questions.push(...drafted.questions)
    resources.push(...drafted.resources)
  }
  void scope
  const buffer = await buildWorkbook({ talks, questions, resources })
  return { buffer, talks: talks.length, questions: questions.length, resources: resources.length }
}
