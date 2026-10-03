import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-naskh-arabic/400.css'
import type { ReactNode } from 'react'
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BEAT_LABEL, UI } from './copy'
import { BLACK, CREAM, GOLD, GOLD_DEEP, GOLD_INK, HEIGHT, INK, PAPER, SAFE, SANS, SERIF, WIDTH } from './theme'
import { activeBeat, wordsVisibleAt, type BeatId, type ScheduledTalk, type ScheduledWord } from './timing'

export type StyleId = 'kinetic' | 'windows' | 'conversation' | 'cinema' | 'unfold'

export type TalkProps = ScheduledTalk & {
  style: StyleId
  id: string
  title: string
  speaker: string
  courseTitle: string
  lane: string
  /** Path under remotion/public, or null when the render is silent. */
  audio: string | null
}

const beatOrder: BeatId[] = ['hook', 'turn', 'land']

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

function Safe({ children, color = CREAM }: { children: ReactNode; color?: string }) {
  return (
    <AbsoluteFill style={{ background: color, fontFamily: SANS, color: INK }}>
      <div style={{ position: 'absolute', top: SAFE.top, right: SAFE.side, bottom: SAFE.bottom, left: SAFE.side }}>{children}</div>
    </AbsoluteFill>
  )
}

function Words({
  words,
  time,
  size,
  color,
  highlight = GOLD,
  weight = 600,
  align = 'left',
}: {
  words: ScheduledWord[]
  time: number
  size: number
  color: string
  highlight?: string
  weight?: number
  align?: 'left' | 'center'
}) {
  const shown = wordsVisibleAt(words, time)
  return (
    <p style={{ margin: 0, fontFamily: SERIF, fontWeight: weight, fontSize: size, lineHeight: 1.12, letterSpacing: '-0.01em', textAlign: align, color }}>
      {shown.map((word, index) => {
        const age = time - word.showAt
        const rise = interpolate(age, [0, 0.16], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const opacity = interpolate(age, [0, 0.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const fresh = index === shown.length - 1 && age < 0.45
        return (
          <span key={`${word.beat}-${index}`} style={{ display: 'inline-block', transform: `translateY(${rise}px)`, opacity, color: fresh ? highlight : color, marginRight: size * 0.22 }}>
            {word.text}
          </span>
        )
      })}
    </p>
  )
}

function BeatRail({ time, talk, light }: { time: number; talk: TalkProps; light: boolean }) {
  const beat = activeBeat(talk, time)
  const index = beatOrder.indexOf(beat)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', position: 'relative', height: 40, borderRadius: 999, background: light ? 'rgba(20,18,14,0.08)' : 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '33.333%', background: GOLD, transform: `translateX(${index * 100}%)` }} />
      {beatOrder.map((id) => (
        <span key={id} style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: id === beat ? GOLD_INK : light ? INK : CREAM }}>
          {BEAT_LABEL[id]}
        </span>
      ))}
    </div>
  )
}

function LearnMore({ talk }: { talk: TalkProps }) {
  return (
    <Safe color={CREAM}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Hoopoe size={84} />
        <div style={{ marginTop: 28, fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD_DEEP }}>{talk.lane}</div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 64, lineHeight: 0.98, margin: '18px 0 12px', color: INK }}>{UI.learnMore}</h1>
        <div style={{ width: 56, height: 2, background: GOLD, marginBottom: 18 }} />
        <p style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 1.2, margin: 0, color: INK }}>{talk.title}</p>
        <p style={{ marginTop: 'auto', marginBottom: 8, fontSize: 18, fontWeight: 650 }}>{talk.speaker}</p>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD_DEEP }}>{UI.fullTalk}</div>
      </div>
    </Safe>
  )
}

/** Long beats (the 39-word land) shrink so the whole spoken line stays inside the safe area. */
function fitted(text: string, preferred: number) {
  const chars = text.length
  const scale = chars > 200 ? 0.62 : chars > 150 ? 0.74 : chars > 110 ? 0.86 : 1
  return Math.max(30, Math.round(preferred * scale))
}

function Kinetic({ talk, time }: { talk: TalkProps; time: number }) {
  const beat = activeBeat(talk, time)
  const words = talk.words.filter((word) => word.beat === beat)
  const line = talk.beats.find((span) => span.beat === beat)?.text || ''
  return (
    <Safe color={BLACK}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: CREAM }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{UI.kinetic}</span>
          <Hoopoe size={48} />
        </div>
        <div style={{ marginTop: 28 }}>
          <BeatRail talk={talk} time={time} light={false} />
        </div>
        <div style={{ marginTop: 48, flex: 1 }}>
          <Words words={words} time={time} size={fitted(line, 56)} color={CREAM} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 650, opacity: 0.8 }}>{talk.speaker}</div>
      </div>
    </Safe>
  )
}

function Windows({ talk, time }: { talk: TalkProps; time: number }) {
  const beat = activeBeat(talk, time)
  return (
    <Safe color={CREAM}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{talk.lane}</span>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD_DEEP }}>{UI.windows}</span>
        </div>
        <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
          {talk.beats.map((span, index) => {
            const open = time >= span.videoAt
            const current = span.beat === beat && open
            return (
              <div key={span.beat} style={{ minHeight: current ? 250 : 108, borderRadius: 22, background: PAPER, border: `1px solid ${open ? GOLD : '#e4d9c4'}`, padding: '16px 18px', boxShadow: open ? '0 10px 24px rgba(40, 30, 10, 0.06)' : 'none', overflow: 'hidden' }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, color: GOLD_DEEP }}>0{index + 1}</div>
                {open ? (
                  <div style={{ marginTop: 8 }}>
                    <Words words={talk.words.filter((word) => word.beat === span.beat)} time={time} size={current ? 36 : 22} color={INK} highlight={GOLD_DEEP} />
                  </div>
                ) : (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                    <span style={{ width: 28, height: 22, border: `2px solid ${INK}`, borderRadius: 6, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: -10, left: 6, width: 12, height: 10, border: `2px solid ${INK}`, borderBottom: 0, borderRadius: '8px 8px 0 0' }} />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Safe>
  )
}

function Conversation({ talk, time }: { talk: TalkProps; time: number }) {
  return (
    <Safe color={BLACK}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: CREAM }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{UI.conversation}</div>
        <div style={{ marginTop: 8, fontFamily: SERIF, fontSize: 28 }}>{talk.speaker}</div>
        <div style={{ marginTop: 28, display: 'grid', gap: 16 }}>
          {talk.beats.map((span) => {
            if (time < span.videoAt) return null
            return (
              <div key={span.beat} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12, alignItems: 'end' }}>
                <Hoopoe size={52} />
                <div style={{ background: 'rgba(253,250,243,0.1)', border: '1px solid rgba(220,166,67,0.45)', borderRadius: '22px 22px 22px 8px', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>{BEAT_LABEL[span.beat]}</div>
                  <Words words={talk.words.filter((word) => word.beat === span.beat)} time={time} size={28} color={CREAM} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Safe>
  )
}

function Cinema({ talk, time }: { talk: TalkProps; time: number }) {
  return (
    <Safe color={BLACK}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: CREAM }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <span>{UI.cinema}</span>
          <span>{talk.lane}</span>
        </div>
        <div style={{ width: 64, height: 2, background: GOLD, margin: '22px 0 28px' }} />
        <div style={{ display: 'grid', gap: 26, flex: 1, alignContent: 'center' }}>
          {talk.beats.map((span, index) => (
            <Words key={span.beat} words={talk.words.filter((word) => word.beat === span.beat)} time={time} size={index === 0 ? 48 : 34} color={CREAM} align="left" />
          ))}
        </div>
        <div style={{ fontSize: 16, fontWeight: 650 }}>{talk.speaker}</div>
      </div>
    </Safe>
  )
}

function Unfold({ talk, time }: { talk: TalkProps; time: number }) {
  const beat = activeBeat(talk, time)
  const span = talk.beats.find((row) => row.beat === beat) || talk.beats[0]
  const peel = span ? interpolate(time - span.videoAt, [0, 0.45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
  return (
    <Safe color={CREAM}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{UI.unfold}</span>
          <Hoopoe size={44} />
        </div>
        <div style={{ marginTop: 36, position: 'relative', flex: 1, borderRadius: 28, background: PAPER, border: '1px solid #e4d9c4', padding: 28, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD_DEEP }}>{span ? BEAT_LABEL[span.beat] : UI.hook}</div>
          <div style={{ marginTop: 18 }}>
            <Words words={talk.words.filter((word) => word.beat === beat)} time={time} size={46} color={INK} highlight={GOLD_DEEP} />
          </div>
          {peel < 0.98 ? (
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 150, height: 150, background: `linear-gradient(225deg, ${GOLD} 0%, ${CREAM} 48%, transparent 50%)`, transform: `scale(${1.15 - peel})`, transformOrigin: '100% 100%' }} />
          ) : null}
        </div>
      </div>
    </Safe>
  )
}

export function TypographyFilm(talk: TalkProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const time = frame / fps
  const sit = talk.style === 'cinema' ? talk.cinemaSeconds : talk.spokenSeconds
  if (time >= sit) return <LearnMore talk={talk} />
  const picture = {
    kinetic: <Kinetic talk={talk} time={time} />,
    windows: <Windows talk={talk} time={time} />,
    conversation: <Conversation talk={talk} time={time} />,
    cinema: <Cinema talk={talk} time={time} />,
    unfold: <Unfold talk={talk} time={time} />,
  }[talk.style]
  return (
    <AbsoluteFill style={{ width: WIDTH, height: HEIGHT }}>
      {picture}
      {talk.audio ? <Audio src={staticFile(talk.audio)} /> : null}
    </AbsoluteFill>
  )
}
