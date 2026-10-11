#!/usr/bin/env node
/**
 * Stand-in for yt-dlp. The local Bring in tests point YT_DLP_PATH here.
 * HEARTS_YT role: YT_DLP_ROLE=helper writes captions or a wav. Any other role
 * refuses a caption or audio download the way a bot wall would.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const catalogue = JSON.parse(readFileSync(new URL('./catalogue.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const target = args[args.length - 1] || ''
const helper = process.env.YT_DLP_ROLE === 'helper'

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
    const watch = url.searchParams.get('v')
    if (watch) return watch
    const parts = url.pathname.split('/').filter(Boolean)
    if (url.hostname === 'youtu.be') return parts[0] || ''
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') return parts[1] || ''
    return ''
  } catch {
    return /^[A-Za-z0-9_-]{6,}$/.test(input) ? input : ''
  }
}

function isList(input) {
  try {
    const url = new URL(input)
    if (url.searchParams.get('v')) return false
    if (url.pathname === '/playlist' || url.searchParams.get('list')) return 'playlist'
    if (url.pathname.startsWith('/@') || url.pathname.startsWith('/channel/') || url.pathname.startsWith('/c/') || url.pathname.startsWith('/user/')) return 'channel'
  } catch {
    return ''
  }
  return ''
}

function byId(id) {
  return catalogue.videos.find((row) => row.id === id) || null
}

function line(video) {
  return [video.id, video.title, video.duration, video.channel, video.channelId, video.captions].join('\t')
}

function botWall() {
  console.error("ERROR: Sign in to confirm you're not a bot")
  process.exit(1)
}

function wavBytes() {
  const samples = 16000
  const data = Buffer.alloc(samples * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(32000, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

function writeTemplate(template, ext, body) {
  const file = template.replace('%(id)s', videoId(target) || 'audio').replace('%(ext)s', ext)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
  return file
}

const CAPTION_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
people gather and listen

00:00:04.200 --> 00:00:06.500
the salah keeps a heart soft
`

if (flag('--flat-playlist')) {
  const kind = isList(target)
  if (kind === 'playlist') {
    for (const id of catalogue.playlist) {
      const video = byId(id)
      if (video) console.log(line(video))
    }
    process.exit(0)
  }
  if (kind === 'channel') {
    const seen = new Set()
    for (const video of catalogue.videos) {
      if (seen.has(video.id)) continue
      seen.add(video.id)
      console.log(line(video))
    }
    process.exit(0)
  }
  const video = byId(videoId(target))
  if (!video) {
    console.error('ERROR: Video unavailable')
    process.exit(1)
  }
  console.log(line(video))
  process.exit(0)
}

if (!helper && (flag('--write-subs') || flag('--list-subs') || flag('-x') || flag('--extract-audio'))) botWall()

const video = byId(videoId(target))
if (!video) {
  console.error('ERROR: Video unavailable')
  process.exit(1)
}

if (flag('--list-subs')) {
  if (video.captions === 'no') {
    console.error('There are no subtitles for this video')
    process.exit(1)
  }
  console.log('en       English')
  process.exit(0)
}

if (flag('-x') || flag('--extract-audio')) {
  const template = option('-o') || `${video.id}.%(ext)s`
  writeTemplate(template, 'wav', wavBytes())
  console.log(String(video.duration))
  process.exit(0)
}

if (flag('--write-subs') || flag('--write-auto-subs')) {
  if (video.captions !== 'yes') {
    console.error('ERROR: There are no subtitles for the requested languages')
    process.exit(1)
  }
  const template = option('-o') || `${video.id}.%(ext)s`
  writeTemplate(template, 'vtt', CAPTION_VTT)
  console.log(String(video.duration))
  process.exit(0)
}

console.log(line(video))
