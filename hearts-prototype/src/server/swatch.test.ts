import assert from 'node:assert/strict'
import test from 'node:test'
import { swatchHostAllowed } from './swatch'

test('swatches only read film artwork hosts', () => {
  assert.equal(swatchHostAllowed('https://i.vimeocdn.com/video/abc.jpg'), true)
  assert.equal(swatchHostAllowed('https://i.ytimg.com/vi/abc/hqdefault.jpg'), true)
  assert.equal(swatchHostAllowed('/book-stills/1.jpg'), true)
  assert.equal(swatchHostAllowed('https://evil.example/a.jpg'), false)
  assert.equal(swatchHostAllowed('http://i.vimeocdn.com/a.jpg'), false)
  assert.equal(swatchHostAllowed('/../etc/passwd'), false)
  assert.equal(swatchHostAllowed('not a url'), false)
})
