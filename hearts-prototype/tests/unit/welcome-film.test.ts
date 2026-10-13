import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isVideoFile } from '../../src/screens/app/welcome'

test('a welcome film plays natively when the link is a video file or our own storage', () => {
  assert.equal(isVideoFile('https://cdn.example/welcome.mp4'), true)
  assert.equal(isVideoFile('https://cdn.example/welcome.MP4?token=1'), true)
  assert.equal(isVideoFile('https://cdn.example/welcome.m4v#t=2'), true)
  assert.equal(isVideoFile('https://cdn.example/welcome.webm'), true)
  assert.equal(isVideoFile('https://cdn.example/welcome.mov'), true)
  assert.equal(isVideoFile('/api/hearts/file/12'), true)
  assert.equal(isVideoFile('https://hearts.example/api/media/file/9?download=1'), true)
  assert.equal(isVideoFile('https://www.youtube.com/watch?v=ECaTWkof57E'), false)
  assert.equal(isVideoFile('https://www.youtube.com/embed/ECaTWkof57E'), false)
  assert.equal(isVideoFile('https://cdn.example/notes.pdf'), false)
})
