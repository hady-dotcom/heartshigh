import { Composition } from 'remotion'
import { TypographyFilm, type StyleId, type TalkProps } from './Film'
import { FPS, HEIGHT, WIDTH } from './theme'
import { durationSeconds, scheduleTalk } from './timing'

export const STYLES: StyleId[] = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold']

const sampleSchedule = scheduleTalk({
  hook: 'Sometimes the heart hears one true line.',
  turn: 'But the next line turns the thought.',
  land: 'And the last line lets it land.',
  hookAt: 12,
  turnAt: 18.4,
  landAt: 25,
  cues: [
    ['Sometimes', 12],
    ['the', 12.3],
    ['heart', 12.55],
    ['hears', 12.9],
    ['one', 13.2],
    ['true', 13.5],
    ['line.', 13.9],
    ['But', 18.4],
    ['the', 18.6],
    ['next', 18.85],
    ['line', 19.2],
    ['turns', 19.5],
    ['the', 19.8],
    ['thought.', 20.15],
    ['And', 25],
    ['the', 25.25],
    ['last', 25.5],
    ['line', 25.85],
    ['lets', 26.15],
    ['it', 26.4],
    ['land.', 26.75],
  ].map(([text, talkAt]) => ({ text: String(text), talkAt: Number(talkAt) })),
})

export const sampleTalk = (style: StyleId): TalkProps => ({
  ...sampleSchedule,
  style,
  id: 'sample',
  title: 'A short talk',
  speaker: 'The speaker',
  courseTitle: 'The full talk',
  lane: 'Reflections',
  audio: null,
})

export function frameCount(talk: TalkProps) {
  const seconds = durationSeconds(talk, talk.style === 'cinema')
  return Math.max(1, Math.round(seconds * FPS))
}

export function RemotionRoot() {
  return (
    <>
      {STYLES.map((style) => (
        <Composition
          key={style}
          id={style}
          component={TypographyFilm}
          durationInFrames={frameCount(sampleTalk(style))}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={sampleTalk(style)}
          calculateMetadata={({ props }) => ({
            durationInFrames: frameCount(props),
            fps: FPS,
            width: WIDTH,
            height: HEIGHT,
          })}
        />
      ))}
    </>
  )
}
