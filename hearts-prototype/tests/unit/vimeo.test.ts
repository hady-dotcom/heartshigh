import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingestVimeoLink, looksLikeVimeo, parseVimeoLink, pickVimeoTrack, vimeoPlayerSrc, VIMEO_KEY_MISSING } from '../../src/lib/vimeo'
import { bringInSourceKind, looseBringInPaste, markBringInSkips } from '../../src/lib/bring-in-plan'

test('reads the number and the private hash from every Vimeo link shape', () => {
  assert.deepEqual(parseVimeoLink('https://vimeo.com/76979871'), { id: '76979871', hash: '', url: 'https://vimeo.com/76979871' })
  assert.deepEqual(parseVimeoLink('https://vimeo.com/76979871/8272103f6e'), { id: '76979871', hash: '8272103f6e', url: 'https://vimeo.com/76979871/8272103f6e' })
  assert.equal(parseVimeoLink('https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0')?.hash, '8272103f6e')
  assert.equal(parseVimeoLink('https://vimeo.com/76979871?share=copy')?.hash, '')
  assert.equal(parseVimeoLink('https://vimeo.com/channels/staffpicks/76979871')?.id, '76979871')
  assert.equal(parseVimeoLink('https://vimeo.com/showcase/abc'), null)
  assert.equal(parseVimeoLink('https://youtube.com/watch?v=abc'), null)
  assert.equal(looksLikeVimeo('https://www.vimeo.com/1'), true)
})

test('the player link carries the hash so unlisted films play', () => {
  assert.equal(vimeoPlayerSrc('76979871', '8272103f6e', { api: '1' }), 'https://player.vimeo.com/video/76979871?h=8272103f6e&api=1')
  assert.equal(vimeoPlayerSrc('76979871', '', { api: '1' }), 'https://player.vimeo.com/video/76979871?api=1')
  assert.equal(vimeoPlayerSrc('76979871', 'bad hash!'), 'https://player.vimeo.com/video/76979871')
})

test('Bring in treats a Vimeo film link as one film', () => {
  assert.equal(bringInSourceKind('https://vimeo.com/76979871/8272103f6e'), 'video')
  assert.equal(bringInSourceKind('https://vimeo.com/showcase/abc'), 'bad')
  assert.equal(looseBringInPaste('https://vimeo.com/76979871\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ'), true)
})

test('Vimeo talks under 5 minutes are skipped, longer ones and unknown lengths stay in', () => {
  const base = { url: '', title: 't', channel: '', channelId: '', captions: 'unknown' as const, lineSpeaker: '', provider: 'vimeo' as const }
  const rows = markBringInSkips([
    { ...base, id: 'vimeo:1000001', durationSeconds: 120 },
    { ...base, id: 'vimeo:1000002', durationSeconds: 1800 },
    { ...base, id: 'vimeo:1000003', durationSeconds: null },
    { ...base, id: 'vimeo:1000002', durationSeconds: 1800 },
  ], new Set())
  assert.deepEqual(rows.map((row) => row.skipReason), ['short', '', '', 'duplicate'])
  assert.equal(rows[1].provider, 'vimeo')
})

test('picks your own captions before Vimeo auto captions, and your language first', () => {
  const tracks = [
    { type: 'captions', language: 'en-x-autogen', name: 'English (auto-generated)', link: 'auto' },
    { type: 'subtitles', language: 'en', name: 'English', link: 'mine' },
    { type: 'subtitles', language: 'ar', name: 'Arabic', link: 'arabic' },
    { type: 'captions', language: 'en', name: 'English', link: '' },
  ]
  assert.equal(pickVimeoTrack(tracks, 'en')?.link, 'mine')
  assert.equal(pickVimeoTrack(tracks, 'ar')?.link, 'arabic')
  assert.equal(pickVimeoTrack([tracks[0]], 'en')?.link, 'auto')
  assert.equal(pickVimeoTrack([], 'en'), null)
})

function fakeVimeo(calls: string[], tracks: unknown[]) {
  return async (url: string, init?: RequestInit) => {
    calls.push(`${url} ${(init?.headers as Record<string, string> | undefined)?.Authorization ? 'with-key' : 'no-key'}`)
    if (url.includes('oembed')) return Response.json({ title: 'Public title', author_name: 'Leon', duration: 900 })
    if (url.includes('/texttracks')) return Response.json({ data: tracks })
    if (url.includes('api.vimeo.com/videos/')) return Response.json({ name: 'Private title', duration: 1800, user: { name: 'Leon' } })
    if (url === 'https://captions.test/a.vtt') return new Response('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello there.\n')
    return new Response('', { status: 404 })
  }
}

test('without a key it still gets the title and length, and says plainly to add the key', async () => {
  const calls: string[] = []
  const result = await ingestVimeoLink({ id: '76979871', hash: 'abc123', url: 'https://vimeo.com/76979871/abc123' }, { token: '', fetcher: fakeVimeo(calls, []) })
  assert.equal(result.ok, false)
  assert.equal(!result.ok && result.reason, 'no-key')
  assert.equal(result.note, VIMEO_KEY_MISSING)
  assert.equal(VIMEO_KEY_MISSING, 'Add your Vimeo key to pull words.')
  assert.equal(result.meta?.title, 'Public title')
  assert.equal(result.durationSeconds, 900)
  assert.ok(calls.every((call) => call.endsWith('no-key')))
  assert.ok(!calls.some((call) => call.includes('texttracks')))
})

test('with a key it asks for the private film by number:hash and returns its words', async () => {
  const calls: string[] = []
  const result = await ingestVimeoLink({ id: '76979871', hash: 'abc123', url: 'https://vimeo.com/76979871/abc123' }, {
    token: 'k',
    fetcher: fakeVimeo(calls, [{ type: 'captions', language: 'en-x-autogen', name: 'English (auto-generated)', link: 'https://captions.test/a.vtt' }]),
  })
  assert.equal(result.ok, true)
  assert.match(result.ok ? result.transcript : '', /Hello there/)
  assert.equal(result.durationSeconds, 1800)
  assert.ok(calls.some((call) => call.includes('/videos/76979871:abc123/texttracks') && call.endsWith('with-key')))
  assert.ok(!calls.some((call) => call.startsWith('https://captions.test/') && call.endsWith('with-key')), 'the key is never sent to the caption file host')
})

test('with a key but no captions, it says so in plain words', async () => {
  const result = await ingestVimeoLink({ id: '76979871', hash: '', url: 'https://vimeo.com/76979871' }, { token: 'k', fetcher: fakeVimeo([], []) })
  assert.equal(!result.ok && result.reason, 'no-captions')
  assert.match(result.note, /no captions on Vimeo yet/)
})
