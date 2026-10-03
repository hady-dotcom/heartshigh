import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-naskh-arabic/400.css'
import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { EMPHASIS, phraseSpans } from './emphasis'
import { lineWords, linesOnScreen, phraseLines, withoutStutters } from './lines'
import { UI } from './copy'
import { BLACK, CREAM, GOLD, GOLD_DEEP, GOLD_INK, INK, SAFE, SANS, SERIF, WIDTH } from './theme'
import { cardAt, type BeatId, type BeatSpan, type ScheduledTalk, type ScheduledWord } from './timing'

export type StyleId = 'kinetic' | 'windows' | 'conversation' | 'cinema' | 'unfold'

export type FootageClip = {
  beat: BeatId
  /** Path under remotion/public. Time 0 in the file is the window start. */
  src: string
  windowStart: number
  in: number
  out: number
}

export type TalkProps = ScheduledTalk & {
  style: StyleId
  id: string
  title: string
  speaker: string
  courseTitle: string
  lane: string
  /** Path under remotion/public, or null when the picture carries its own sound. */
  audio: string | null
  footage?: FootageClip[] | null
  /** Gold phrases for this render. When a beat is missing here, the editorial list is used. */
  emphasis?: Partial<Record<BeatId, string[]>> | null
  /** Batch renders are 720×1280. The approval films stay 540×960. */
  width?: number
  height?: number
}

/** Ordinary words. Larger than the old caption size, still smaller than a landing. */
const BODY = 64
/** Width of the column beside the head, in a 540-wide frame. */
const COLUMN = 336
/** Top of that column. The headroom above the eyes, not the lap. */
const TOP = 48

/** Rough Inter-bold width, in ems, so a landing can grow until it fills the column. */
function ems(text: string) {
  let width = 0
  for (const ch of text) {
    const c = ch.toLowerCase()
    if ("ilj.,'!|’".includes(c)) width += 0.32
    else if (c === 'm' || c === 'w') width += 0.92
    else if ('rft'.includes(c)) width += 0.44
    else if (c === ' ') width += 0.28
    else width += 0.6
  }
  return Math.max(0.8, width)
}

function goldPixelSize(words: { text: string }[]) {
  const longest = Math.max(...words.map((word) => ems(word.text)))
  const fit = Math.floor((COLUMN * 0.98) / longest)
  const want = words.length <= 1 ? 156 : words.length === 2 ? 128 : words.length === 3 ? 112 : 96
  return Math.min(want, Math.max(fit, BODY + 12))
}

function blockHeight(words: { text: string }[], size: number) {
  let line = 0
  let lines = 1
  const gap = size * 0.26
  for (const word of words) {
    const width = ems(word.text) * size + gap
    if (line > 0 && line + width > COLUMN) {
      lines += 1
      line = width
    } else line += width
  }
  return lines * size * 1.08
}

function Hoopoe({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="30" fill={GOLD} />
      <path d="M34 40c8 1 14-4 16-8-6 1-10 0-14-3 2 6 1 9-2 11z" fill={BLACK} />
      <path d="M18 36c2-8 8-14 16-16 1 6-1 10-6 14-4 3-8 4-10 2z" fill={INK} />
      <path d="M30 22c1-8 6-14 8-16 2 4 2 10 0 16-2 1-5 1-8 0z" fill={GOLD_INK} />
      <path d="M33 18c3-6 8-8 10-8-2 4-4 8-8 10-1-1-2-1-2-2z" fill={BLACK} />
      <circle cx="40" cy="30" r="1.3" fill={CREAM} />
    </svg>
  )
}

function LearnMore({ talk }: { talk: TalkProps }) {
  const scale = useScale()
  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ position: 'absolute', top: SAFE.top * scale, right: SAFE.side * scale, bottom: SAFE.bottom * scale, left: SAFE.side * scale, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Hoopoe size={84 * scale} />
        <div style={{ marginTop: 28 * scale, fontSize: 14 * scale, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD_DEEP }}>{talk.lane}</div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 64 * scale, lineHeight: 0.98, margin: `${18 * scale}px 0 ${12 * scale}px`, color: INK }}>{UI.learnMore}</h1>
        <div style={{ width: 56 * scale, height: 2, background: GOLD, marginBottom: 18 * scale }} />
        <p style={{ fontFamily: SERIF, fontSize: 32 * scale, lineHeight: 1.2, margin: 0, color: INK }}>{talk.title}</p>
        <p style={{ marginTop: 'auto', marginBottom: 8 * scale, fontSize: 18 * scale, fontWeight: 650 }}>{talk.speaker}</p>
        <div style={{ fontSize: 14 * scale, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD_DEEP }}>{UI.fullTalk}</div>
      </div>
    </AbsoluteFill>
  )
}

function beatCard(talk: TalkProps, beat: BeatId, time: number) {
  return cardAt(talk.words.filter((word) => word.beat === beat), time)
}

function shotAt(talk: TalkProps, time: number) {
  const beat = talk.beats.find((row) => time >= row.videoAt - 1e-4 && time < row.videoAt + row.duration - 1e-4)
  const clip = beat && talk.footage ? talk.footage.find((row) => row.beat === beat.beat) || null : null
  return { beat, clip }
}

function titleBreak(talk: TalkProps, time: number) {
  for (let index = 0; index < talk.beats.length - 1; index++) {
    const end = talk.beats[index].videoAt + talk.beats[index].duration
    const next = talk.beats[index + 1].videoAt
    if (next - end > 0.4 && time >= end - 1e-3 && time < next - 1e-3) return index + 1
  }
  return -1
}

function pushScale(time: number, beat: BeatSpan, holds: number[]) {
  let sample = time
  for (const hold of holds) if (time >= hold - 0.26 && time < hold) sample = hold - 0.26
  return interpolate(sample, [beat.videoAt, beat.videoAt + beat.duration], [1, 1.07], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

function Punch({ time, at, gold, size, font, fade = false, color, children }: { time: number; at: number; gold: boolean; size: number; font: string; fade?: boolean; color?: string; children: ReactNode }) {
  const age = time - at
  const rise = interpolate(age, [0, 0.12], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const scale = interpolate(age, [0, 0.12], [gold ? 1.28 : 1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = interpolate(age, [0, 0.06], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (fade ? interpolate(age, [0.62, 0.95], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1)
  return (
    <span style={{ display: 'inline-block', marginRight: '0.26em', transform: `translateY(${rise}px) scale(${scale})`, transformOrigin: 'left bottom', opacity, color: color || (gold ? GOLD : undefined), fontFamily: font, fontWeight: gold ? 700 : 600, fontSize: size, lineHeight: 1.02, letterSpacing: gold ? '-0.02em' : '-0.01em' }}>
      {children}
    </span>
  )
}

function Footage({ talk, time, holds, position = 'center center' }: { talk: TalkProps; time: number; holds: number[]; position?: string }) {
  const { fps } = useVideoConfig()
  const { beat } = shotAt(talk, time)
  const scale = beat ? pushScale(time, beat, holds) : 1
  const dark = holds.some((hold) => time >= hold) ? 0.55 : 0.22
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BLACK }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {talk.footage?.map((clip) => {
          const span = talk.beats.find((row) => row.beat === clip.beat)
          if (!span) return null
          const from = Math.round(span.videoAt * fps)
          const total = Math.max(1, Math.round(span.duration * fps))
          const media = Math.max(1, Math.min(total, Math.round((clip.out - clip.in) * fps)))
          const trimBefore = Math.max(0, Math.round((clip.in - clip.windowStart) * fps))
          const fit = { width: '100%', height: '100%', objectFit: 'cover' as const, objectPosition: position }
          const hold = total - media
          return (
            <Sequence key={clip.beat} from={from} durationInFrames={total}>
              <Sequence durationInFrames={media}>
                <OffthreadVideo src={staticFile(clip.src)} trimBefore={trimBefore} style={fit} />
              </Sequence>
              {hold > 0 ? (
                <Sequence from={media} durationInFrames={hold}>
                  <Freeze frame={0}>
                    <OffthreadVideo muted src={staticFile(clip.src)} trimBefore={trimBefore + media - 1} style={fit} />
                  </Freeze>
                </Sequence>
              ) : null}
            </Sequence>
          )
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 36%, transparent 28%, rgba(20,18,14,${dark}) 80%)`, opacity: holds.some((hold) => time + 0.02 >= hold) ? 1 : 0.35 }} />
    </AbsoluteFill>
  )
}

function linesFor(card: ScheduledWord[], talk: TalkProps, beat: BeatId) {
  const words = withoutStutters(card)
  const chosen = talk.emphasis?.[beat]
  const phrases = chosen?.length ? chosen : EMPHASIS[talk.id]?.[beat] || []
  return phraseLines(words, phraseSpans(words, phrases))
}

function useScale() {
  const { width } = useVideoConfig()
  return width / WIDTH
}

/** Even beats leave the left side clear. Odd beats leave the right. The face parks on the other side. */
function wordsOnLeft(talk: TalkProps, time: number) {
  const { beat } = shotAt(talk, time)
  if (!beat) return true
  return talk.beats.findIndex((row) => row.beat === beat.beat) % 2 === 0
}

function faceShift(talk: TalkProps, time: number) {
  return wordsOnLeft(talk, time) ? '32% 42%' : '68% 42%'
}

/**
 * Type in the upper negative space beside the head. Gold, when it has landed,
 * takes the top of that column and is larger than the words around it.
 * Nothing is placed over the lap.
 */
function UpperWords({ talk, time, font, bubbles = false, stack = false }: { talk: TalkProps; time: number; font: string; bubbles?: boolean; stack?: boolean }) {
  const scale = useScale()
  const { beat } = shotAt(talk, time)
  if (!beat) return null
  const lines = linesOnScreen(linesFor(beatCard(talk, beat.beat, time), talk, beat.beat), time, stack)
  const left = wordsOnLeft(talk, time)
  const column = COLUMN * scale
  let cursor = TOP * scale
  const shadow = '0 2px 18px rgba(20,18,14,0.9)'
  const painted: ReactNode[] = []
  for (const line of lines) {
    const words = lineWords(line, time)
    const size = (line.gold ? goldPixelSize(line.words) : BODY) * scale
    const height = blockHeight(words, size / scale) * scale
    if (cursor > 500 * scale) break
    const top = cursor
    cursor += height + (bubbles ? 18 : 12) * scale
    const color = bubbles ? (line.gold ? GOLD_INK : CREAM) : line.gold ? GOLD : CREAM
    const body = words.map((word) => (
      <Punch key={`${line.phrase}-${word.showAt}-${word.text}`} time={time} at={word.showAt} gold={line.gold} size={size} font={font} color={color} fade={!line.gold && !bubbles && !stack}>
        {word.text}
      </Punch>
    ))
    painted.push(
      <div key={`${line.phrase}-${line.words[0].showAt}-${line.gold}`} style={{ position: 'absolute', top, width: column, left: left ? 16 * scale : undefined, right: left ? undefined : 16 * scale, textAlign: left ? 'left' : 'right', color: CREAM, textShadow: bubbles ? undefined : shadow }}>
        {bubbles ? (
          <div style={{ display: 'inline-block', maxWidth: column, background: line.gold ? 'rgba(220,166,67,0.94)' : 'rgba(20,18,14,0.82)', color, borderRadius: line.gold ? 18 * scale : 16 * scale, padding: `${8 * scale}px ${12 * scale}px` }}>
            {body}
          </div>
        ) : (
          body
        )}
      </div>,
    )
  }
  return <>{painted}</>
}

function holdsFor(talk: TalkProps, time: number, beat: BeatId) {
  return linesFor(beatCard(talk, beat, time), talk, beat).filter((line) => line.gold).map((line) => line.words[0].showAt)
}

function Kinetic({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  return (
    <AbsoluteFill>
      <Footage talk={talk} time={time} holds={holdsFor(talk, time, beat.beat)} position={faceShift(talk, time)} />
      <UpperWords talk={talk} time={time} font={SANS} />
    </AbsoluteFill>
  )
}

function Windows({ talk, time }: { talk: TalkProps; time: number }) {
  const scale = useScale()
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: CREAM }} />
  const inset = 14 * scale
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <div style={{ position: 'absolute', top: inset, right: inset, bottom: inset, left: inset, overflow: 'hidden', borderRadius: 26 * scale, border: `${3 * scale}px solid ${GOLD}`, background: BLACK }}>
        <Footage talk={talk} time={time} holds={holdsFor(talk, time, beat.beat)} position={faceShift(talk, time)} />
        <UpperWords talk={talk} time={time} font={SERIF} />
      </div>
    </AbsoluteFill>
  )
}

function Conversation({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  return (
    <AbsoluteFill>
      <Footage talk={talk} time={time} holds={holdsFor(talk, time, beat.beat)} position={faceShift(talk, time)} />
      <UpperWords talk={talk} time={time} font={SANS} bubbles />
    </AbsoluteFill>
  )
}

function Cinema({ talk, time }: { talk: TalkProps; time: number }) {
  const scale = useScale()
  const breakAt = titleBreak(talk, time)
  if (breakAt >= 0) {
    const numeral = ['I', 'II', 'III'][breakAt] || ''
    return (
      <AbsoluteFill style={{ background: BLACK, color: CREAM, fontFamily: SERIF, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 18 * scale, letterSpacing: '0.42em' }}>{numeral}</div>
        <div style={{ width: 56 * scale, height: 2, background: GOLD, margin: `${20 * scale}px 0` }} />
        <div style={{ fontSize: 72 * scale, fontWeight: 600, lineHeight: 0.95, textAlign: 'center', padding: `0 ${32 * scale}px` }}>{talk.title}</div>
      </AbsoluteFill>
    )
  }
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  const bar = 56 * scale
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', top: bar, right: 0, bottom: bar, left: 0, overflow: 'hidden' }}>
        <Footage talk={talk} time={time} holds={holdsFor(talk, time, beat.beat)} position={faceShift(talk, time)} />
        <UpperWords talk={talk} time={time} font={SERIF} />
      </div>
    </AbsoluteFill>
  )
}

function Unfold({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  return (
    <AbsoluteFill>
      <Footage talk={talk} time={time} holds={holdsFor(talk, time, beat.beat)} position={faceShift(talk, time)} />
      <UpperWords talk={talk} time={time} font={SERIF} stack />
    </AbsoluteFill>
  )
}

export function TypographyFilm(talk: TalkProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const time = frame / fps
  const sit = talk.spokenSeconds
  if (time >= sit) return <LearnMore talk={talk} />
  const picture = {
    kinetic: <Kinetic talk={talk} time={time} />,
    windows: <Windows talk={talk} time={time} />,
    conversation: <Conversation talk={talk} time={time} />,
    cinema: <Cinema talk={talk} time={time} />,
    unfold: <Unfold talk={talk} time={time} />,
  }[talk.style]
  return (
    <AbsoluteFill style={{ width, height, background: BLACK }}>
      {picture}
      {!talk.footage?.length && talk.audio ? <Audio src={staticFile(talk.audio)} /> : null}
    </AbsoluteFill>
  )
}
