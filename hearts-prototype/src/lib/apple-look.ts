/** Preview-only colour pass. Default pages stay as they are until ?look=apple. */

export type AppleSurface = '' | 'home' | 'courses' | 'course' | 'player' | 'master' | 'cms'

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
  if (path === '/master') return 'master'
  if (path === '/admin') return 'cms'
  const match = path.match(/^\/p\/parenting(\/.*)?$/)
  if (!match) return ''
  const rest = (match[1] || '/').replace(/\/$/, '') || '/'
  if (rest === '/') return 'home'
  if (rest === '/courses') return 'courses'
  if (!/^\/course\/\d+$/.test(rest)) return ''
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return query.get('part') ? 'player' : 'course'
}

export function appleLookEnabled(lookParam: string | null, cookie: string) {
  if (lookParam === 'off') return false
  if (lookParam === 'apple') return true
  return /(?:^|; )hh_look=apple(?:;|$)/.test(cookie)
}

export const APPLE_LOOK_BOOT = `(function(){try{var q=new URLSearchParams(location.search).get('look');if(q==='apple')document.cookie='hh_look=apple; Path=/; Max-Age=1209600; SameSite=Lax';if(q==='off')document.cookie='hh_look=; Path=/; Max-Age=0; SameSite=Lax';var on=q==='apple'||(q!=='off'&&/(?:^|; )hh_look=apple(?:;|$)/.test(document.cookie));var root=document.documentElement;if(!on){delete root.dataset.look;delete root.dataset.lookSurface;return;}var path=(location.pathname.length>1?location.pathname.replace(/\\/$/,''):location.pathname);var surface='';if(path==='/master')surface='master';else if(path==='/admin')surface='cms';else{var m=path.match(/^\\/p\\/parenting(\\/.*)?$/);if(m){var rest=(m[1]||'/').replace(/\\/$/,'')||'/';if(rest==='/')surface='home';else if(rest==='/courses')surface='courses';else if(/^\\/course\\/\\d+$/.test(rest))surface=/(?:^|[?&])part=/.test(location.search)?'player':'course';}}if(!surface){delete root.dataset.look;delete root.dataset.lookSurface;return;}root.dataset.look='apple';root.dataset.lookSurface=surface;}catch(e){}})();`

function cookieOn() {
  return appleLookEnabled(null, document.cookie)
}

export function applyAppleLook() {
  const url = new URL(window.location.href)
  const look = url.searchParams.get('look')
  if (look === 'apple') document.cookie = 'hh_look=apple; Path=/; Max-Age=1209600; SameSite=Lax'
  if (look === 'off') document.cookie = 'hh_look=; Path=/; Max-Age=0; SameSite=Lax'
  const on = look === 'off' ? false : look === 'apple' || cookieOn()
  const surface = on ? appleSurface(url.pathname, url.search) : ''
  const root = document.documentElement
  if (!surface) {
    delete root.dataset.look
    delete root.dataset.lookSurface
    return
  }
  root.dataset.look = 'apple'
  root.dataset.lookSurface = surface
  paintTiles()
  if (surface === 'master' && window.innerWidth < 900) {
    const menu = document.querySelector<HTMLDetailsElement>('.desk-menu')
    if (menu && !menu.open) menu.open = true
  }
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
      const letter = (link.textContent || '').trim().charAt(0).toUpperCase()
      if (letter) link.dataset.mark = letter
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
