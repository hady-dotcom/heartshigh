import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bookStillPath, bookStillUrl, readBookSource, sourceDurationChoice } from './book-source'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('a source length replaces a missing length and keeps a Vimeo length that disagrees', () => {
  assert.deepEqual(sourceDurationChoice(0, 93.568), { seconds: 94, flagged: false })
  assert.deepEqual(sourceDurationChoice(94, 93.568), { seconds: null, flagged: false })
  assert.deepEqual(sourceDurationChoice(100, 102), { seconds: 102, flagged: false })
  assert.deepEqual(sourceDurationChoice(100, 102.4), { seconds: null, flagged: true })
  assert.deepEqual(sourceDurationChoice(230, 94), { seconds: null, flagged: true })
  assert.deepEqual(sourceDurationChoice(0, 0), { seconds: null, flagged: false })
})

test('only a book still path is accepted', () => {
  assert.equal(bookStillPath('1239220778'), '/book-stills/1239220778.jpg')
  assert.equal(bookStillPath('../etc/passwd'), '')
  assert.equal(bookStillUrl('/book-stills/1239220778.jpg'), '/book-stills/1239220778.jpg')
  assert.equal(bookStillUrl('https://i.vimeocdn.com/video/a.jpg'), '')
  assert.equal(bookStillUrl('/book-stills/../secret.jpg'), '')
})

test('the source file has 168 lengths with frames and 25 blanks', () => {
  const rows = readBookSource(readFileSync(path.join(root, 'uploads/book-source-lengths.csv'), 'utf8'))
  const known = rows.filter((row) => row.seconds)
  const blank = rows.filter((row) => !row.seconds)
  assert.equal(rows.length, 193)
  assert.equal(known.length, 168)
  assert.equal(blank.length, 25)
  assert.equal(new Set(rows.map((row) => row.id)).size, 193)
  for (const row of known) {
    const file = path.join(root, 'public', bookStillPath(row.id).slice(1))
    assert.equal(existsSync(file), true, row.id)
    const head = readFileSync(file).subarray(0, 3)
    assert.deepEqual([...head], [0xff, 0xd8, 0xff])
  }
  for (const row of blank) {
    assert.equal(existsSync(path.join(root, 'public/book-stills', `${row.id}.jpg`)), false)
  }
})
