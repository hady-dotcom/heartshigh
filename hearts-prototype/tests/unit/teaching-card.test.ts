import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The unit runner compiles JSX with the classic runtime.
Object.assign(globalThis, { React })
const { TeachingCard } = await import('../../src/components/journey/teaching-card')

const scene = (audio: string | null) => ({
  style: 'cinema' as const,
  scene: '/slides/bg-cinema-road.jpg',
  destination: 'clip' as const,
  beats: [
    { beat: 'hook' as const, quote: 'And they will all stand before Him on the day of Judgment.', gold: '', audio },
    { beat: 'turn' as const, quote: 'The Prophet said the strong one holds himself back.', gold: '', audio },
  ],
})

test('a scenic card with no audio offers no Mute button; with audio it does', () => {
  const render = (audio: string | null) => renderToStaticMarkup(createElement(TeachingCard, { scene: scene(audio), speaker: 'A Speaker', course: 'Imported', lane: 'Reflections', onClip: () => undefined }))
  const silent = render(null)
  assert.match(silent, /data-audio="no"/)
  assert.doesNotMatch(silent, /scene-voice/)
  assert.match(render('/card-audio/x/hook.mp3'), /data-testid="scene-voice"/)
})
