import { crc32 } from 'node:zlib'
import { SEQUENCE_COPY } from './sequence'

export type ExportVideo = {
  order: number
  title: string
  speaker: string
  provider: 'youtube' | 'vimeo'
  id: string
  hash: string
  durationSeconds: number
  hook: string
  turn: string
  land: string
  question: string
}

export type ExportPortal = {
  name: string
  slug: string
  colour: string
  accent: string
  logoUrl: string
  lockOrder: boolean
  note: string
  /** When set, opening the file starts the first film and shows this code. */
  joinCode?: string
}

function dosStamp(date = new Date('2026-01-01T00:00:00Z')) {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2)
  const day = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  return { time, day }
}

/** A zip that stores files as they are. No extra library. */
export function zipStore(files: { name: string; data: string | Uint8Array }[]) {
  const { time, day } = dosStamp()
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const data = typeof file.data === 'string' ? Buffer.from(file.data, 'utf8') : Buffer.from(file.data)
    const crc = crc32(data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(day, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += local.length + name.length + data.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralBuf, end])
}

/** Read a zip this app wrote, so a test can open it without another tool. */
export function readZipStore(buf: Buffer) {
  const files: Record<string, string> = {}
  let offset = 0
  while (offset + 30 <= buf.length && buf.readUInt32LE(offset) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(offset + 26)
    const extraLen = buf.readUInt16LE(offset + 28)
    const size = buf.readUInt32LE(offset + 22)
    const start = offset + 30 + nameLen + extraLen
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8')
    files[name] = buf.subarray(start, start + size).toString('utf8')
    offset = start + size
  }
  return files
}

function readme(portal: ExportPortal) {
  const code = portal.joinCode ? `Join code: ${portal.joinCode}\nOpening index.html starts the first film. You are already in.\n\n` : ''
  return `# ${portal.name}

This folder is a copy of the learner app for demos.

${code}1. Open index.html in a browser. You can double-click it.
2. The films play in order, from 1 to the last.
3. Your place is saved in this browser only. It is not sent anywhere.
4. When a film ends, the next one starts after a short pause. Press Next if it does not.
5. If a film is locked, you will see "${SEQUENCE_COPY.lock}"
6. ${portal.note || SEQUENCE_COPY.examples}

You do not need an account for this copy.
`
}

const YOUTUBE_HOST = 'https://www.youtube.com'

function page(portal: ExportPortal, videos: ExportVideo[]) {
  const data = JSON.stringify({ portal, videos }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(portal.name)}</title>
<style>
  :root { --c: ${portal.colour}; --a: ${portal.accent}; }
  body { margin: 0; font-family: Georgia, "Iowan Old Style", serif; background: #f7f4ef; color: #1c2430; }
  header { background: var(--c); color: #fff; padding: 16px 18px; display: flex; gap: 12px; align-items: center; }
  header img { width: 42px; height: 42px; object-fit: cover; border-radius: 8px; background: #fff; }
  main { padding: 16px; max-width: 720px; margin: 0 auto; }
  .film { background: #111; aspect-ratio: 16/9; }
  .film iframe { width: 100%; height: 100%; border: 0; }
  button, a.btn { background: var(--a); color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; font: inherit; text-decoration: none; display: inline-block; }
  ol { padding: 0; list-style: none; }
  li { border-bottom: 1px solid #e4dccd; padding: 10px 0; }
  li a { color: inherit; text-decoration: none; }
  .lock { color: #8a4b3a; font-size: 14px; }
  .note { background: #fff; border-left: 4px solid var(--a); padding: 10px 12px; }
</style>
</head>
<body>
<header>
  ${portal.logoUrl ? `<img alt="" src="${escapeHtml(portal.logoUrl)}">` : ''}
  <div><strong>${escapeHtml(portal.name)}</strong><div>Watch in order</div>${portal.joinCode ? `<div id="join-code">Join code ${escapeHtml(portal.joinCode)}</div>` : ''}</div>
</header>
<main>
  <p class="note" id="note"></p>
  <p id="count"></p>
  <div class="film" id="stage"></div>
  <p id="callouts"></p>
  <p><button type="button" id="next">Next</button></p>
  <ol id="list"></ol>
</main>
<script id="data" type="application/json">${data}</script>
<script>
const data = JSON.parse(document.getElementById('data').textContent)
const key = 'sequence-demo:' + data.portal.slug
const saved = JSON.parse(localStorage.getItem(key) || '{"done":[],"at":{}}')
const params = new URLSearchParams(location.search)
let index = Math.max(0, Math.min(data.videos.length - 1, Number(params.get('v') || 0) - 1 || 0))
function done(i) { return saved.done.includes(i) }
function locked(i) { return data.portal.lockOrder && i > 0 && !done(i - 1) }
function remember() { localStorage.setItem(key, JSON.stringify(saved)) }
function show() {
  const film = data.videos[index]
  document.getElementById('count').textContent = (saved.done.length) + ' of ' + data.videos.length + ' videos'
  const note = document.getElementById('note')
  if (data.portal.joinCode && index === 0 && !saved.done.length) note.textContent = 'You are in. Join code ' + data.portal.joinCode
  else note.textContent = locked(index) ? 'Watch the previous one first.' : (data.portal.note || '')
  const lines = [film.hook && ('Opening line: ' + film.hook), film.turn && ('The turn: ' + film.turn), film.land && ('Landing line: ' + film.land), film.question && ('A question: ' + film.question)].filter(Boolean)
  document.getElementById('callouts').textContent = lines.join(' ')
  const stage = document.getElementById('stage')
  const start = Number(saved.at[film.id] || 0)
  if (film.provider === 'vimeo') {
    const hash = film.hash ? '&h=' + encodeURIComponent(film.hash) : ''
    stage.innerHTML = '<iframe src="https://player.vimeo.com/video/' + film.id + '?autoplay=0' + hash + '" allow="autoplay; fullscreen" allowfullscreen></iframe>'
  } else {
    stage.innerHTML = '<iframe id="yt" src="' + ${JSON.stringify(YOUTUBE_HOST)} + '/embed/' + film.id + '?enablejsapi=1&start=' + start + '" allow="autoplay; fullscreen" allowfullscreen></iframe>'
  }
  const list = document.getElementById('list')
  list.innerHTML = ''
  data.videos.forEach(function (row, i) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = '?v=' + (i + 1)
    link.textContent = (i + 1) + '. ' + row.title
    item.appendChild(link)
    if (locked(i)) {
      const small = document.createElement('div')
      small.className = 'lock'
      small.textContent = 'Watch the previous one first.'
      item.appendChild(small)
    }
    list.appendChild(item)
  })
}
function finish() {
  if (!saved.done.includes(index)) saved.done.push(index)
  remember()
  if (index < data.videos.length - 1) {
    index += 1
    history.replaceState(null, '', '?v=' + (index + 1))
    show()
  }
}
document.getElementById('next').addEventListener('click', finish)
window.addEventListener('message', function (event) {
  let body = event.data
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch (error) { return } }
  if (body && body.event === 'onStateChange' && body.info === 0) finish()
  if (body && (body.event === 'infoDelivery' || body.event === 'onReady') && body.info && body.info.currentTime) {
    const film = data.videos[index]
    saved.at[film.id] = Math.floor(body.info.currentTime)
    remember()
  }
})
show()
const frame = document.getElementById('yt')
if (frame) frame.addEventListener('load', function () {
  frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*')
})
</script>
</body>
</html>
`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch)
}

export function buildExportFiles(portal: ExportPortal, videos: ExportVideo[]) {
  const readmeText = readme(portal)
  const html = page(portal, videos)
  const json = JSON.stringify({ name: portal.name, slug: portal.slug, lockOrder: portal.lockOrder, videos: videos.map(({ order, title, speaker, provider, id, durationSeconds }) => ({ order, title, speaker, provider, id, durationSeconds })) }, null, 2)
  return [
    { name: 'README.md', data: readmeText },
    { name: 'index.html', data: html },
    { name: 'videos.json', data: `${json}\n` },
  ]
}

export function buildExportZip(portal: ExportPortal, videos: ExportVideo[]) {
  return zipStore(buildExportFiles(portal, videos))
}

/** Learner titles, Vimeo ids, and the first question. Drive and transcript links stay out. */
export function courseFilmsToExport(films: { order: number; publicTitle: string; vimeoId: string; callouts: { prompt: string }[] }[]): ExportVideo[] {
  return films.map((film, index) => ({
    order: film.order || index + 1,
    title: film.publicTitle,
    speaker: '',
    provider: 'vimeo' as const,
    id: film.vimeoId,
    hash: '',
    durationSeconds: 0,
    hook: '',
    turn: '',
    land: '',
    question: film.callouts[0]?.prompt || '',
  }))
}
