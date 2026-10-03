import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-naskh-arabic/400.css'
import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { EMPHASIS, phraseSpans } from './emphasis'
import { UI } from './copy'
import { BLACK, CREAM, GOLD, GOLD_DEEP, GOLD_INK, HEIGHT, INK, SAFE, SANS, SERIF, WIDTH } from './theme'
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
}

const SMALL = 34
const KEY = 68
const PHRASE = 56
const LINE = 42

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
  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: SANS, color: INK }}>
      <div style={{ position: 'absolute', top: SAFE.top, right: SAFE.side, bottom: SAFE.bottom, left: SAFE.side, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Hoopoe size={84} />
        <div style={{ marginTop: 28, fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD_DEEP }}>{talk.lane}</div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 64, lineHeight: 0.98, margin: '18px 0 12px', color: INK }}>{UI.learnMore}</h1>
        <div style={{ width: 56, height: 2, background: GOLD, marginBottom: 18 }} />
        <p style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 1.2, margin: 0, color: INK }}>{talk.title}</p>
        <p style={{ marginTop: 'auto', marginBottom: 8, fontSize: 18, fontWeight: 650 }}>{talk.speaker}</p>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD_DEEP }}>{UI.fullTalk}</div>
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

function keyed(card: ScheduledWord[], talk: TalkProps, beat: BeatId) {
  const chosen = talk.emphasis?.[beat]
  return phraseSpans(card, chosen?.length ? chosen : EMPHASIS[talk.id]?.[beat] || [])
}

function shown(card: ScheduledWord[], time: number) {
  return card.map((word, index) => ({ word, index })).filter((row) => row.word.showAt <= time + 1e-4)
}

function Kinetic({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  const card = beatCard(talk, beat.beat, time)
  const spans = keyed(card, talk, beat.beat)
  const inSpan = (index: number) => spans.find((span) => index >= span.from && index <= span.to)
  const visible = shown(card, time)
  const lastKey = [...spans].reverse().find((span) => card[span.from].showAt <= time + 1e-4)
  const connectors = visible.filter((row) => !inSpan(row.index) && (!lastKey || row.index > lastKey.to)).slice(-5)
  const side = talk.beats.findIndex((row) => row.beat === beat.beat) % 2 === 0 ? 'flex-start' : 'flex-end'
  return (
    <AbsoluteFill>
      <Footage talk={talk} time={time} holds={spans.map((span) => card[span.from].showAt)} />
      <div style={{ position: 'absolute', left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom, display: 'flex', flexDirection: 'column', alignItems: side, textAlign: side === 'flex-start' ? 'left' : 'right' }}>
        <div style={{ maxWidth: 280, color: CREAM, textShadow: '0 2px 14px rgba(20,18,14,0.9)' }}>
          {connectors.map((row) => (
            <Punch key={`${row.index}-${row.word.showAt}`} time={time} at={row.word.showAt} gold={false} size={SMALL} font={SANS} fade>
              {row.word.text}
            </Punch>
          ))}
        </div>
        <div style={{ maxWidth: 460, marginTop: 8 }}>
          {spans.map((span) => {
            const words = card.slice(span.from, span.to + 1).filter((word) => word.showAt <= time + 1e-4)
            if (!words.length) return null
            const size = words.length > 2 ? PHRASE : KEY
            return (
              <div key={span.phrase} style={{ textShadow: '0 2px 16px rgba(20,18,14,0.85)' }}>
                {words.map((word) => (
                  <Punch key={`${span.phrase}-${word.showAt}`} time={time} at={word.showAt} gold size={size} font={SANS}>
                    {word.text}
                  </Punch>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Windows({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  const card = beat ? beatCard(talk, beat.beat, time) : []
  const spans = beat ? keyed(card, talk, beat.beat) : []
  const inSpan = (index: number) => spans.find((span) => index >= span.from && index <= span.to)
  const visible = shown(card, time)
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <div style={{ position: 'absolute', top: 108, left: 36, width: 468, height: 500, overflow: 'hidden', borderRadius: 22, border: `3px solid ${GOLD}`, boxShadow: '0 16px 40px rgba(20,18,14,0.18)', background: BLACK }}>
        <Footage talk={talk} time={time} holds={spans.map((span) => card[span.from].showAt)} />
      </div>
      <div style={{ position: 'absolute', left: SAFE.side, right: SAFE.side, top: 624, bottom: SAFE.bottom, overflow: 'hidden' }}>
        <div style={{ color: INK, fontFamily: SERIF }}>
          {visible.filter((row) => !inSpan(row.index)).slice(-8).map((row) => (
            <Punch key={`${row.index}-${row.word.showAt}`} time={time} at={row.word.showAt} gold={false} size={SMALL} font={SERIF}>
              {row.word.text}
            </Punch>
          ))}
        </div>
        {spans.map((span) => {
          const words = card.slice(span.from, span.to + 1).filter((word) => word.showAt <= time + 1e-4)
          if (!words.length) return null
          return (
            <div key={span.phrase}>
              {words.map((word) => (
                <Punch key={`${span.phrase}-${word.showAt}`} time={time} at={word.showAt} gold color={GOLD_DEEP} size={span.to - span.from > 1 ? PHRASE : KEY} font={SERIF}>
                  {word.text}
                </Punch>
              ))}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function Conversation({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  const card = beatCard(talk, beat.beat, time)
  const spans = keyed(card, talk, beat.beat)
  const bubbles: { key: string; words: ScheduledWord[]; gold: boolean; at: number }[] = []
  let run: ScheduledWord[] = []
  const flush = () => {
    if (!run.length) return
    bubbles.push({ key: `run-${run[0].showAt}`, words: run, gold: false, at: run[0].showAt })
    run = []
  }
  card.forEach((word, index) => {
    const span = spans.find((row) => index >= row.from && index <= row.to)
    if (span && index === span.from) {
      flush()
      bubbles.push({ key: span.phrase, words: card.slice(span.from, span.to + 1), gold: true, at: word.showAt })
    } else if (!span) {
      run.push(word)
      if (run.length === 4) flush()
    }
  })
  flush()
  const open = bubbles.filter((bubble) => time + 1e-4 >= bubble.at).slice(-2)
  return (
    <AbsoluteFill>
      <Footage talk={talk} time={time} holds={spans.map((span) => card[span.from].showAt)} />
      <div style={{ position: 'absolute', left: SAFE.side, right: 120, bottom: SAFE.bottom, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        {open.map((bubble) => (
          <div key={bubble.key} style={{ maxWidth: 300, background: bubble.gold ? 'rgba(220,166,67,0.94)' : 'rgba(20,18,14,0.78)', color: bubble.gold ? GOLD_INK : CREAM, borderRadius: '20px 20px 20px 6px', padding: '12px 14px', fontFamily: SANS }}>
            {bubble.words.filter((word) => word.showAt <= time + 1e-4).map((word) => (
              <Punch key={`${bubble.key}-${word.showAt}`} time={time} at={word.showAt} gold={false} size={bubble.gold ? PHRASE : SMALL} font={SANS}>
                {word.text}
              </Punch>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Cinema({ talk, time }: { talk: TalkProps; time: number }) {
  const breakAt = titleBreak(talk, time)
  if (breakAt >= 0) {
    const numeral = ['I', 'II', 'III'][breakAt] || ''
    return (
      <AbsoluteFill style={{ background: BLACK, color: CREAM, fontFamily: SERIF, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 18, letterSpacing: '0.42em' }}>{numeral}</div>
        <div style={{ width: 56, height: 2, background: GOLD, margin: '20px 0' }} />
        <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 0.95 }}>{talk.title}</div>
      </AbsoluteFill>
    )
  }
  const { beat } = shotAt(talk, time)
  if (!beat) return <AbsoluteFill style={{ background: BLACK }} />
  const card = beatCard(talk, beat.beat, time)
  const spans = keyed(card, talk, beat.beat)
  const inSpan = (index: number) => spans.some((span) => index >= span.from && index <= span.to)
  const visible = shown(card, time)
  const landed = spans.filter((span) => card[span.from].showAt <= time + 1e-4)
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <div style={{ position: 'absolute', top: 118, right: 0, bottom: 176, left: 0, overflow: 'hidden' }}>
        <Footage talk={talk} time={time} holds={spans.map((span) => card[span.from].showAt)} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 118, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 16 }}>
        <div style={{ color: CREAM, fontFamily: SERIF, fontSize: 16, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{talk.title}</div>
      </div>
      <div style={{ position: 'absolute', left: SAFE.side, right: SAFE.side, bottom: 28, height: 136, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {landed.length ? null : (
          <div style={{ color: CREAM, fontFamily: SERIF }}>
            {visible.filter((row) => !inSpan(row.index)).slice(-6).map((row) => (
              <Punch key={`${row.index}-${row.word.showAt}`} time={time} at={row.word.showAt} gold={false} size={SMALL} font={SERIF}>
                {row.word.text}
              </Punch>
            ))}
          </div>
        )}
        {landed.slice(-1).map((span) => (
          <div key={span.phrase}>
            {card.slice(span.from, span.to + 1).filter((word) => word.showAt <= time + 1e-4).map((word) => (
              <Punch key={`${span.phrase}-${word.showAt}`} time={time} at={word.showAt} gold size={span.to - span.from > 1 ? PHRASE : KEY} font={SERIF}>
                {word.text}
              </Punch>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

function Unfold({ talk, time }: { talk: TalkProps; time: number }) {
  const { beat } = shotAt(talk, time)
  const card = beat ? beatCard(talk, beat.beat, time) : []
  const spans = beat ? keyed(card, talk, beat.beat) : []
  const lines: { key: string; words: ScheduledWord[]; gold: boolean }[] = []
  let run: ScheduledWord[] = []
  const flush = () => {
    if (!run.length) return
    lines.push({ key: `line-${run[0].showAt}`, words: run, gold: false })
    run = []
  }
  card.forEach((word, index) => {
    const span = spans.find((row) => index >= row.from && index <= row.to)
    if (span && index === span.from) {
      flush()
      lines.push({ key: span.phrase, words: card.slice(span.from, span.to + 1), gold: true })
    } else if (!span) {
      run.push(word)
      if (run.length === 3) flush()
    }
  })
  flush()
  const open = lines.filter((line) => line.words.some((word) => word.showAt <= time + 1e-4))
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 214, right: 0, overflow: 'hidden', background: BLACK }}>
        <Footage talk={talk} time={time} holds={spans.map((span) => card[span.from].showAt)} position="center 42%" />
      </div>
      <div style={{ position: 'absolute', top: SAFE.top, bottom: SAFE.bottom, left: 18, width: 186, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        {open.map((line) => (
          <div key={line.key} style={{ color: line.gold ? GOLD_DEEP : INK }}>
            {line.words.filter((word) => word.showAt <= time + 1e-4).map((word) => (
              <Punch key={`${line.key}-${word.showAt}`} time={time} at={word.showAt} gold={line.gold} color={line.gold ? GOLD_DEEP : INK} size={line.gold ? LINE : SMALL} font={SERIF}>
                {word.text}
              </Punch>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

export function TypographyFilm(talk: TalkProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
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
    <AbsoluteFill style={{ width: WIDTH, height: HEIGHT, background: BLACK }}>
      {picture}
      {!talk.footage?.length && talk.audio ? <Audio src={staticFile(talk.audio)} /> : null}
    </AbsoluteFill>
  )
}
