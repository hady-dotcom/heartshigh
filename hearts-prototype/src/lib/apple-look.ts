/** Learner look. On for every portal unless the address asks for ?look=off. The desk and CMS stay as they are. */

import { coverIcon, iconDataUri } from '@/lib/cover-art'

export type AppleSurface = '' | 'home' | 'courses' | 'course' | 'player' | 'week' | 'me' | 'signin'

const TILES = [
  '--hh-look-blue',
  '--hh-look-green',
  '--hh-look-orange',
  '--hh-look-purple',
  '--hh-look-pink',
  '--hh-look-teal',
  '--hh-look-indigo',
  '--hh-look-red',
  '--hh-look-cyan',
  '--hh-look-mint',
  '--hh-look-brown',
]

/** Same hues as the tokens, for the console, which does not load tokens.css. */
const TILE_HEX = ['#0070eb', '#23873d', '#ad6500', '#a54dd1', '#e0284b', '#237f8f', '#5856d6', '#db3329', '#247da6', '#00837d', '#8b7251']

export function appleSurface(pathname: string, search = ''): AppleSurface {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (path === '/admin' || path.startsWith('/admin/') || path === '/master' || path.startsWith('/master/')) return ''
  if (path === '/login' || path === '/join' || path === '/forgot' || path === '/reset') return 'signin'
  const match = path.match(/^\/p\/[a-z0-9-]+(\/.*)?$/i)
  if (!match) return ''
  const rest = (match[1] || '/').replace(/\/$/, '') || '/'
  if (rest === '/' || rest === '/home') return 'home'
  if (rest === '/courses' || rest === '/lanes') return 'courses'
  if (rest === '/week') return 'week'
  if (rest === '/me' || rest.startsWith('/me/')) return 'me'
  if (rest === '/start' || rest === '/welcome') return 'signin'
  if (/^\/course\/\d+$/.test(rest)) {
    const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    return query.get('part') ? 'player' : 'course'
  }
  return 'home'
}

/** On unless this visit, or a saved ?look=off, asks for the previous pages. */
export function appleLookEnabled(lookParam: string | null, cookie: string) {
  if (lookParam === 'off') return false
  if (lookParam === 'apple') return true
  return !/(?:^|; )hh_look=off(?:;|$)/.test(cookie)
}

export const APPLE_LOOK_BOOT = `(function(){try{var q=new URLSearchParams(location.search).get('look');if(q==='apple')document.cookie='hh_look=; Path=/; Max-Age=0; SameSite=Lax';if(q==='off')document.cookie='hh_look=off; Path=/; Max-Age=1209600; SameSite=Lax';var root=document.documentElement;var off=q==='off'||(q!=='apple'&&/(?:^|; )hh_look=off(?:;|$)/.test(document.cookie));if(off){delete root.dataset.look;delete root.dataset.lookSurface;return;}var path=(location.pathname.length>1?location.pathname.replace(/\\/$/,''):location.pathname);if(path==='/admin'||path.indexOf('/admin/')===0||path==='/master'||path.indexOf('/master/')===0){delete root.dataset.look;delete root.dataset.lookSurface;return;}var surface='';if(path==='/login'||path==='/join'||path==='/forgot'||path==='/reset')surface='signin';else{var m=path.match(/^\\/p\\/[a-z0-9-]+(\\/.*)?$/i);if(m){var rest=(m[1]||'/').replace(/\\/$/,'')||'/';if(rest==='/'||rest==='/home')surface='home';else if(rest==='/courses'||rest==='/lanes')surface='courses';else if(rest==='/week')surface='week';else if(rest==='/me'||rest.indexOf('/me/')===0)surface='me';else if(rest==='/start'||rest==='/welcome')surface='signin';else if(/^\\/course\\/\\d+$/.test(rest))surface=/(?:^|[?&])part=/.test(location.search)?'player':'course';else surface='home';}}if(!surface){delete root.dataset.look;delete root.dataset.lookSurface;return;}root.dataset.look='apple';root.dataset.lookSurface=surface;}catch(e){}})();`

export function applyAppleLook() {
  const url = new URL(window.location.href)
  const look = url.searchParams.get('look')
  if (look === 'apple') document.cookie = 'hh_look=; Path=/; Max-Age=0; SameSite=Lax'
  if (look === 'off') document.cookie = 'hh_look=off; Path=/; Max-Age=1209600; SameSite=Lax'
  const surface = appleLookEnabled(look, document.cookie) ? appleSurface(url.pathname, url.search) : ''
  const root = document.documentElement
  if (!surface) {
    delete root.dataset.look
    delete root.dataset.lookSurface
    return
  }
  root.dataset.look = 'apple'
  root.dataset.lookSurface = surface
  paintTiles()
}

function tileColor(index: number) {
  const name = TILES[index % TILES.length]
  const defined = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return defined ? `var(${name})` : TILE_HEX[index % TILE_HEX.length]
}

function paintTiles() {
  const links = document.querySelectorAll<HTMLElement>('.side-nav a.nav, .nav__link, .tab')
  links.forEach((link, index) => {
    link.style.setProperty('--ico', tileColor(index))
    if (link.classList.contains('nav__link')) {
      const name = coverIcon((link.textContent || '').trim(), link.getAttribute('href') || String(index))
      link.style.setProperty('--mark', iconDataUri(name))
    }
  })
  document.querySelectorAll<HTMLElement>('[data-testid="portal-card"]').forEach((row, index) => {
    row.style.setProperty('--art', `var(${TILES[index % TILES.length]})`)
  })
}

function hashTile(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0
  return `var(${TILES[hash % TILES.length]})`
}

function backgroundUrl(el: HTMLElement | null) {
  if (!el) return ''
  const value = el.style.backgroundImage || getComputedStyle(el).backgroundImage
  const match = value.match(/url\(["']?([^"')]+)["']?\)/)
  return match?.[1] || ''
}

function sampleImage(img: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = 12
  canvas.height = 12
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, 12, 12)
  const data = ctx.getImageData(0, 0, 12, 12).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i]
    const G = data[i + 1]
    const B = data[i + 2]
    const max = Math.max(R, G, B)
    const min = Math.min(R, G, B)
    if (max - min < 22 || max < 28) continue
    r += R
    g += G
    b += B
    n += 1
  }
  if (!n) return ''
  return `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`
}

const artCache = new Map<string, string>()
const artPending = new WeakSet<HTMLElement>()

function remember(src: string, value: string) {
  if (!artCache.has(src)) artCache.set(src, value)
  return artCache.get(src) || value
}

function colorFor(src: string, img: HTMLImageElement | null, done: (value: string) => void) {
  const cached = artCache.get(src)
  if (cached) {
    done(cached)
    return
  }
  const finish = (value: string) => done(remember(src, value || hashTile(src)))
  try {
    if (img && img.naturalWidth) {
      finish(sampleImage(img))
      return
    }
  } catch {
    finish('')
    return
  }
  const probe = new Image()
  probe.crossOrigin = 'anonymous'
  probe.onload = () => {
    try {
      finish(sampleImage(probe))
    } catch {
      finish('')
    }
  }
  probe.onerror = () => finish('')
  probe.src = src
}

const ART_SELECTOR = '.course-card, .carry-on, .continue-row, .buffet-row, .course-hero, .library-section, .sequence-module, [data-testid="player-poster"]'

function tintNode(node: HTMLElement) {
  const painted = node.style.getPropertyValue('--art')
  if (node.dataset.art === '1' && painted) {
    const stage = document.querySelector<HTMLElement>('.app-stage')
    if (stage && !stage.style.getPropertyValue('--art')) stage.style.setProperty('--art', painted)
    return
  }
  if (node.dataset.art === '1' || artPending.has(node)) return
  const img = node.querySelector('img')
  const styled = node.matches('[style*="url"]') ? node : node.querySelector<HTMLElement>('[style*="url"]')
  const src = img?.currentSrc || img?.getAttribute('src') || backgroundUrl(styled)
  const apply = (value: string) => {
    node.style.setProperty('--art', value)
    node.dataset.art = '1'
    artPending.delete(node)
    const stage = document.querySelector<HTMLElement>('.app-stage')
    if (stage && !stage.style.getPropertyValue('--art')) stage.style.setProperty('--art', value)
  }
  if (!src) {
    apply(hashTile((node.textContent || 'film').slice(0, 80)))
    return
  }
  artPending.add(node)
  const ready = img && img.complete && img.naturalWidth ? img : null
  colorFor(src, ready, (value) => {
    if (!node.isConnected) return
    apply(value)
  })
  if (!ready && img) {
    img.addEventListener('load', () => colorFor(img.currentSrc || img.src, img, (value) => apply(value)), { once: true })
  }
}

export function watchArtwork() {
  if (document.documentElement.dataset.look !== 'apple') return () => {}
  const paint = () => {
    if (document.documentElement.dataset.look !== 'apple') return
    paintTiles()
    document.querySelectorAll<HTMLElement>(ART_SELECTOR).forEach(tintNode)
  }
  paint()
  const observer = new MutationObserver(() => paint())
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
