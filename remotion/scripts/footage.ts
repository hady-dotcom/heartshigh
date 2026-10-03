// Places each snapped sentence on the face clip. Time 0 in the file is the window start.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { EMPHASIS, phraseSpans } from '../src/emphasis'
import { leanOnStress, placeOnSpeech, speechRuns, type FootageSpan } from '../src/timing'

export type WindowBeat = {
  beat: 'hook' | 'turn' | 'land'
  text: string
  speechStart: number
  speechEnd: number
  in: number
  out: number
  window: { start: number; end: number }
}

export type ClipRef = {
  beat: 'hook' | 'turn' | 'land'
  src: string
  windowStart: number
  in: number
  out: number
}

export function footageFile(root: string, id: string, beat: string) {
  return path.join(root, 'public', 'footage', `${id}-${beat}.mp4`)
}

function levelsOf(file: string, start: number, duration: number, origin: number) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ss', Math.max(0, start).toFixed(3), '-t', Math.max(0.2, duration).toFixed(3), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 32_000_000 })
  const step = 800
  const levels: { at: number; level: number }[] = []
  for (let index = 0; index + step <= raw.length / 4; index += step) {
    let sum = 0
    for (let sample = 0; sample < step; sample++) sum += Math.abs(raw.readFloatLE((index + sample) * 4))
    levels.push({ at: origin + levels.length * 0.05, level: sum / step })
  }
  return levels
}

/** A clip whose time 0 is the sentence start, already cut with the breath in it. */
export function prepareSentence(file: string, beat: 'hook' | 'turn' | 'land', quote: string, start: number, end: number, phrases: string[]): FootageSpan {
  const duration = Math.max(0.4, end - start)
  const levels = levelsOf(file, 0, duration, start)
  const runs = speechRuns(levels.map((row) => row.level), start).filter((run) => run.end > start + 0.05 && run.start < end - 0.02)
  const placed = placeOnSpeech(quote, runs.length ? runs : [{ start: start + Math.min(0.15, duration / 4), end: end - Math.min(0.15, duration / 4) }])
  const times = leanOnStress(placed.map((word) => word.talkAt), phraseSpans(placed, phrases), levels)
  const words = placed.map((word, index) => ({ text: word.text, talkAt: Math.min(end - 0.04, Math.max(start + 0.02, times[index])) }))
  for (let index = 1; index < words.length; index++) if (words[index].talkAt < words[index - 1].talkAt + 0.05) words[index].talkAt = words[index - 1].talkAt + 0.05
  return { beat, text: quote, in: start, out: end, words }
}

export function prepareFootage(remotionRoot: string, id: string) {
  const windows = JSON.parse(readFileSync(path.join(remotionRoot, 'talks', 'windows.json'), 'utf8')) as { talks: { id: string; beats: WindowBeat[] }[] }
  const talk = windows.talks.find((row) => row.id === id)
  if (!talk) return null
  if (talk.beats.some((beat) => !existsSync(footageFile(remotionRoot, id, beat.beat)))) return null
  const beats: FootageSpan[] = talk.beats.map((beat) => {
    const origin = Math.max(beat.window.start, beat.speechStart - 0.2)
    const until = Math.min(beat.window.end, beat.speechEnd + 0.2)
    const levels = levelsOf(footageFile(remotionRoot, id, beat.beat), origin - beat.window.start, until - origin, origin)
    const runs = speechRuns(levels.map((row) => row.level), origin).filter((run) => run.end > beat.speechStart - 0.05 && run.start < beat.speechEnd + 0.05)
    const placed = placeOnSpeech(beat.text, runs.length ? runs : [{ start: beat.speechStart, end: beat.speechEnd }])
    const times = leanOnStress(placed.map((word) => word.talkAt), phraseSpans(placed, EMPHASIS[id]?.[beat.beat] || []), levels)
    const words = placed.map((word, index) => ({ text: word.text, talkAt: Math.min(beat.out - 0.04, Math.max(beat.in + 0.02, times[index])) }))
    for (let index = 1; index < words.length; index++) if (words[index].talkAt < words[index - 1].talkAt + 0.05) words[index].talkAt = words[index - 1].talkAt + 0.05
    return { beat: beat.beat, text: beat.text, in: beat.in, out: beat.out, words }
  })
  const clips: ClipRef[] = talk.beats.map((beat) => ({
    beat: beat.beat,
    src: `footage/${id}-${beat.beat}.mp4`,
    windowStart: beat.window.start,
    in: beat.in,
    out: beat.out,
  }))
  return { beats, clips }
}
