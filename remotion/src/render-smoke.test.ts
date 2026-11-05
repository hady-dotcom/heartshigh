import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'

test('render smoke: a kinetic talk becomes a playable mp4', { timeout: 300_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hearts-type-'))
  const output = path.join(dir, 'smoke.mp4')
  try {
    const serveUrl = await bundle({ entryPoint: path.join(import.meta.dirname, 'index.ts'), webpackOverride: (config) => config })
    const inputProps = {
      style: 'kinetic',
      id: 'smoke',
      title: 'Smoke',
      speaker: 'The speaker',
      courseTitle: 'The full talk',
      lane: 'Reflections',
      audio: null,
      words: [{ text: 'Patience.', talkAt: 1, beat: 'hook', showAt: 0.2 }],
      beats: [{ beat: 'hook', text: 'Patience.', talkAt: 1, videoAt: 0.2, duration: 0.5 }],
      spokenSeconds: 0.45,
      cinemaSeconds: 0.45,
      learnMoreSeconds: 0.2,
    }
    const composition = await selectComposition({ serveUrl, id: 'kinetic', inputProps })
    assert.ok(composition.durationInFrames >= 8 && composition.durationInFrames <= 30)
    assert.equal(composition.width, 540)
    assert.equal(composition.height, 960)
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: output, inputProps, crf: 30, x264Preset: 'ultrafast', concurrency: 2 })
    const bytes = readFileSync(output)
    assert.ok(bytes.length > 1500, `mp4 was ${bytes.length} bytes`)
    assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
