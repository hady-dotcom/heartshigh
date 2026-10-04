'use client'

import { currentSentence, wrapWordLines } from '@/lib/framing/words'
import type { FramingSentence } from '@/lib/framing/types'

export function SpokenWords({ sentences, time, speaker }: { sentences: FramingSentence[]; time: number; speaker?: string }) {
  const sentence = currentSentence(sentences, time)
  if (!sentence) return <div className="fr-words" data-testid="spoken-words" data-empty="yes" />
  const lines = wrapWordLines(sentence.words.map((row) => row.w), 20).slice(0, 5)
  return (
    <div className="fr-words" data-testid="spoken-words" data-sentence={sentence.text}>
      {speaker ? <p className="fr-words-speaker">{speaker}</p> : null}
      <div className="fr-words-page" key={`${sentence.s}:${sentence.text}`}>
        {lines.map((line, index) => (
          <p key={`${index}:${line.join(' ')}`} className="fr-words-line" style={{ animationDelay: `${index * 80}ms` }}>
            {line.map((word, at) => {
              const key = sentence.key && norm(word) === norm(sentence.key)
              return (
                <span key={`${at}:${word}`} className={key ? 'fr-key' : undefined}>
                  {at > 0 ? ' ' : ''}
                  {word}
                </span>
              )
            })}
          </p>
        ))}
      </div>
      <div className="fr-dots" aria-hidden>
        {sentences.map((row, index) => (
          <i key={row.s} className={row === sentence ? 'on' : undefined} data-dot={index} />
        ))}
      </div>
    </div>
  )
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
