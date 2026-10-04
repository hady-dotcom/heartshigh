'use client'

import { currentSentence } from '@/lib/framing/words'
import type { FramingSentence } from '@/lib/framing/types'

export function SpokenWords({ sentences, time, speaker }: { sentences: FramingSentence[]; time: number; speaker?: string }) {
  const sentence = currentSentence(sentences, time)
  if (!sentence) return <div className="fr-words" data-testid="spoken-words" data-empty="yes" />
  const lines = wrapLines(sentence.words.map((row) => row.w), 28)
  const shown = lines.slice(0, 5)
  return (
    <div className="fr-words" data-testid="spoken-words" data-sentence={sentence.text}>
      {speaker ? <p className="fr-words-speaker">{speaker}</p> : null}
      <div className="fr-words-page" key={`${sentence.s}:${sentence.text}`}>
        {shown.map((line, index) => (
          <p key={`${index}:${line}`} className="fr-words-line" style={{ animationDelay: `${index * 80}ms` }}>
            {line.split(' ').map((word, at) => {
              const key = sentence.key && norm(word) === norm(sentence.key)
              return (
                <span key={`${at}:${word}`} className={key ? 'fr-key' : undefined}>
                  {word}
                  {at < line.split(' ').length - 1 ? ' ' : ''}
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

function wrapLines(words: string[], max = 28) {
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
