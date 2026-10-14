#!/usr/bin/env node
// Stand-in for yt-dlp on the sheet-creator port. Search, caption lists, and caption files stay local.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const args = process.argv.slice(2)
const films = {
  hascaps0001: { title: 'Patience in the evening', channel: 'The circle', duration: 640, captions: 'yes' },
  nocaps00001: { title: 'A talk with no captions', channel: 'The circle', duration: 720, captions: 'no' },
  tooshort001: { title: 'A ninety second clip', channel: 'The circle', duration: 89, captions: 'yes' },
}

const VTT = `WEBVTT

00:00:02.000 --> 00:00:06.000
The light of the name is something you can sit with.

00:00:08.000 --> 00:00:13.000
But the heart only settles when that light is received.

00:00:16.000 --> 00:00:21.000
Carry the light into the evening and let it stay with you.
`

function flag(name) {
  return args.includes(name)
}

function option(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] || '' : ''
}

function videoId(input) {
  try {
    const url = new URL(input)
    return url.searchParams.get('v') || ''
  } catch {
    return /^[A-Za-z0-9_-]{11}$/.test(input) ? input : ''
  }
}

function targetId() {
  const raw = [...args].reverse().find((arg) => arg.startsWith('http') || /^[A-Za-z0-9_-]{11}$/.test(arg)) || ''
  return videoId(raw)
}

const search = args.find((arg) => arg.startsWith('ytsearch'))
if (search && flag('--dump-single-json')) {
  const entries = Object.entries(films).map(([id, film]) => ({
    id,
    title: film.title,
    channel: film.channel,
    duration: film.duration,
  }))
  process.stdout.write(`${JSON.stringify({ entries })}\n`)
  process.exit(0)
}

const id = targetId()
const film = films[id]
if (!film) {
  console.error('ERROR: Video unavailable')
  process.exit(1)
}

if (flag('--list-subs')) {
  if (film.captions === 'no') {
    console.error('There are no subtitles for this video')
    process.exit(1)
  }
  process.stdout.write('en       English\n')
  process.exit(0)
}

if (flag('--write-subs') || flag('--write-auto-subs')) {
  await delay(800)
  if (film.captions === 'no') {
    console.error('ERROR: There are no subtitles for the requested languages')
    process.exit(1)
  }
  const template = option('-o') || `${id}.%(ext)s`
  const file = template.replace('%(id)s', id).replace('%(ext)s', 'en.vtt')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, VTT)
  process.stdout.write(`${film.duration}\n`)
  process.exit(0)
}

console.error('ERROR: This stand-in only answers search, list-subs and write-subs.')
process.exit(1)
