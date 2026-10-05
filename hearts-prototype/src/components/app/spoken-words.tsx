'use client'

import { sentencesInWindow, spokenLine, wrapWordLines } from '@/lib/framing/words'
import type { FramingSentence } from '@/lib/framing/types'

export function SpokenWords({
  sentences,
  time,
  speaker,
  from,
  to,
  title,
  titles,
}: {
  sentences: FramingSentence[]
  time: number
  speaker?: string
  from?: number
  to?: number
  /** Talk title — never shown in place of timed words. */
  title?: string | null
  titles?: (string | null | undefined)[]
}) {
  const live = from != null && to != null ? sentencesInWindow(sentences, from, to) : sentences
  const sentence = spokenLine(sentences, time, { from, to, title, titles })
  if (!sentence) return <div className="fr-words" data-testid="spoken-words" data-empty="yes" />
  const lines = wrapWordLines(sentence.words.map((row) => row.w), 20).slice(0, 5)
  return (
    <div className="fr-words" data-testid="spoken-words" data-sentence={sentence.text} data-sentence-start={sentence.s}>
      {speaker ? <p className="fr-words-speaker">{speaker}</p> : null}
      <div className="fr-words-page" key={`${sentence.s}:${sentence.text}`}>
        {lines.map((line, index) => (
          <p key={`${index}:${line.join(' ')}`} className="fr-words-line" style={{ animationDelay: `${index * 80}ms` }}>
            {line.map((word, at) => {
              const key = sentence.key && norm(word) === norm(sentence.key)
              return (
                <span key={`${at}:${word}`} className={key ? 'fr-key' : undefined}>{word}</span>
              )
            })}
          </p>
        ))}
      </div>
      <div className="fr-dots" aria-hidden>
        {live.map((row, index) => (
          <i key={row.s} className={row === sentence ? 'on' : undefined} data-dot={index} />
        ))}
      </div>
    </div>
  )
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
