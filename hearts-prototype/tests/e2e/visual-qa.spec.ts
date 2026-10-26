import { expect, test, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SHOTS = '/opt/cursor/artifacts/screenshots'
const CHECKLIST = '/opt/cursor/artifacts/visual-qa-checklist.json'

type Hit = { screen: string; kind: string; detail: string }

const HADY_LEARNER = [
  ['home', '/p/parenting'],
  ['week', '/p/parenting/week'],
  ['courses', '/p/parenting/courses'],
  ['feed', '/p/parenting/feed'],
  ['me', '/p/parenting/me'],
] as const

const HADY_ADMIN = [
  ['overview', '/p/parenting/admin'],
  ['films', '/p/parenting/admin/sequence'],
  ['features', '/p/parenting/admin/features'],
  ['learners', '/p/parenting/admin/teach'],
  ['bring-in', '/p/parenting/admin/bring-in'],
  ['opening', '/p/parenting/admin/opening'],
  ['codes', '/p/parenting/admin/access'],
  ['settings', '/p/parenting/admin/settings'],
  ['bin', '/p/parenting/admin/bin'],
] as const

const HEARTS_LEARNER = [
  ['home', '/p/east-london'],
  ['lanes', '/p/east-london/lanes'],
  ['lane', '/p/east-london/lanes/trust'],
  ['week', '/p/east-london/week'],
  ['courses', '/p/east-london/courses'],
  ['feed', '/p/east-london/feed'],
  ['me', '/p/east-london/me'],
  ['general', '/p/east-london/garden/general'],
  ['jibril', '/p/east-london/garden/jibril'],
  ['harvest', '/p/east-london/garden/harvest'],
  ['workbook', '/p/east-london/garden/workbook'],
  ['ghunya', '/p/east-london/garden/ghunya'],
] as const

const HEARTS_ADMIN = [
  ['overview', '/p/east-london/admin'],
  ['learners', '/p/east-london/admin/teach'],
  ['diaries', '/p/east-london/admin/diaries'],
  ['codes', '/p/east-london/admin/access'],
  ['feedback', '/p/east-london/admin/feedback'],
  ['safety', '/p/east-london/admin/safety'],
  ['announcements', '/p/east-london/admin/announcements'],
  ['bin', '/p/east-london/admin/bin'],
  ['library', '/p/east-london/admin/library'],
  ['content', '/p/east-london/admin/content'],
  ['bring-in', '/p/east-london/admin/bring-in'],
  ['plans', '/p/east-london/admin/plans'],
  ['circle', '/p/east-london/admin/circle'],
  ['compass', '/p/east-london/admin/compass'],
  ['opening', '/p/east-london/admin/opening'],
  ['questions', '/p/east-london/admin/questions'],
  ['sheet', '/p/east-london/admin/sheet'],
  ['settings', '/p/east-london/admin/settings'],
] as const

const HEARTS_FONTS = new Set([
  'cormorant garamond',
  'libre caslon text',
  'inter',
  'noto naskh arabic',
])

const GENERIC_FONTS = new Set([
  'serif',
  'sans-serif',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'monospace',
  'emoji',
  'arial',
  'helvetica',
  'inherit',
  'initial',
])

function sheetTitles() {
  const csv = readFileSync(path.join(process.cwd(), 'uploads/videos.csv'), 'utf8').trim()
  const lines = csv.split(/\r?\n/)
  const header = splitCsv(lines[0])
  const index = header.indexOf('public_title')
  return lines.slice(1).map((line) => splitCsv(line)[index] || '').filter(Boolean)
}

function splitCsv(line: string) {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else quoted = false
      } else cur += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      out.push(cur)
      cur = ''
    } else cur += char
  }
  out.push(cur)
  return out
}

function norm(value: string) {
  return value.toLowerCase().replace(/^\d+\.\s*/, '').replace(/\s+/g, ' ').trim()
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}

async function settle(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }' }).catch(() => undefined)
  await page.evaluate(async () => {
    const sheet = document.getElementById('hh-google-fonts') as HTMLLinkElement | null
    if (sheet && sheet.media === 'print') {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        sheet.addEventListener('load', done, { once: true })
        if (sheet.sheet) done()
      })
      sheet.media = 'all'
    }
    await document.fonts.ready
  }).catch(() => undefined)
  await page.waitForTimeout(200)
}

function remember(info: TestInfo, screen: string, hits: Hit[]) {
  mkdirSync(path.dirname(CHECKLIST), { recursive: true })
  let current: Record<string, unknown> = {}
  try {
    current = JSON.parse(readFileSync(CHECKLIST, 'utf8')) as Record<string, unknown>
  } catch {
    current = {}
  }
  const project = info.project.name
  const bucket = (current[project] as Record<string, unknown>) || {}
  bucket[screen] = { hits }
  current[project] = bucket
  writeFileSync(CHECKLIST, JSON.stringify(current, null, 2))
}

async function audit(page: Page, screen: string, portal: 'hady' | 'hearts'): Promise<Hit[]> {
  const hits: Hit[] = []
  const dom = await page.evaluate(({ heartsFonts, genericFonts }) => {
    const found: { kind: string; detail: string }[] = []
    const seen = (kind: string) => found.filter((hit) => hit.kind === kind).length
    const push = (kind: string, detail: string) => {
      if (seen(kind) >= 8) return
      found.push({ kind, detail: detail.slice(0, 180) })
    }
    const skipBox = (el: Element) => Boolean(el.closest('.sr-only, [aria-hidden="true"], details:not([open])'))
    const visible = (el: Element) => {
      if (skipBox(el)) return false
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
      const rect = el.getBoundingClientRect()
      return rect.width >= 8 && rect.height >= 8 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
    }

    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,label,span,small,b,td,th')) {
      if (!visible(el)) continue
      if (el.closest('input, textarea, select, script, style')) continue
      const cs = getComputedStyle(el)
      const ox = cs.overflowX
      if (ox !== 'hidden' && ox !== 'clip') continue
      if (cs.textOverflow === 'ellipsis') continue
      const clamp = (cs as CSSStyleDeclaration & { webkitLineClamp?: string }).webkitLineClamp
      if (clamp && clamp !== 'none') continue
      const text = (el.textContent || '').trim()
      if (text.length < 2 || el.clientWidth < 8) continue
      const parent = el.parentElement
      if (parent && getComputedStyle(parent).textOverflow === 'ellipsis') continue
      if (el.scrollWidth > el.clientWidth + 4) {
        push('overflow', `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} “${text.slice(0, 80)}”`)
      }
    }

    const taps = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')].filter(visible)
    for (const el of taps) {
      const cs = getComputedStyle(el)
      if (cs.pointerEvents === 'none') continue
      if (cs.display === 'inline' && el.closest('p, li, h1, h2, h3, h4, h5, h6')) continue
      if (el.matches('input[type="checkbox"], input[type="radio"]')) {
        const host = el.closest('label, td, th')
        if (host) {
          const box = host.getBoundingClientRect()
          if (box.width >= 44 && box.height >= 44) continue
        }
      }
      const rect = el.getBoundingClientRect()
      if (rect.width < 43.5 || rect.height < 43.5) {
        const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 60)
        push('tap', `${Math.round(rect.width)}×${Math.round(rect.height)} ${name}`)
      }
    }

    const clipped = (el: Element) => {
      let left = 0
      let top = 0
      let right = window.innerWidth
      let bottom = window.innerHeight
      const own = el.getBoundingClientRect()
      left = own.left
      top = own.top
      right = own.right
      bottom = own.bottom
      let node = el.parentElement
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node)
        const clip = `${cs.overflow}${cs.overflowX}${cs.overflowY}`
        if (/auto|hidden|clip|scroll/.test(clip)) {
          const box = node.getBoundingClientRect()
          left = Math.max(left, box.left)
          top = Math.max(top, box.top)
          right = Math.min(right, box.right)
          bottom = Math.min(bottom, box.bottom)
        }
        node = node.parentElement
      }
      return { x: left, y: top, r: right, b: bottom }
    }
    const boxes = taps.map((el) => ({ el, ...clipped(el) })).filter((box) => box.r - box.x > 8 && box.b - box.y > 8)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        if (a.el.closest('.tabbar, .glass-bar') || b.el.closest('.tabbar, .glass-bar')) continue
        const width = Math.min(a.r, b.r) - Math.max(a.x, b.x)
        const height = Math.min(a.b, b.b) - Math.max(a.y, b.y)
        if (width > 4 && height > 4) {
          const label = (el: Element) => {
            const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32)
            return `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} “${name}”`
          }
          push('overlap', `${label(a.el)} overlaps ${label(b.el)}`)
        }
      }
    }

    for (const el of document.querySelectorAll('p, li, label, td')) {
      if (!visible(el)) continue
      if (el.closest('h1, h2, h3, h4, h5, h6, small, .eyebrow, .hint, .muted, .page-sub, .brand-word, .shell-brand')) continue
      if (el.matches('small, .eyebrow, .hint, .muted, .page-sub, .brand-word, .shell-brand')) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 15) push('body-text', `${size}px “${(el.textContent || '').trim().slice(0, 60)}”`)
    }
    for (const el of document.querySelectorAll('h1, h2, h3')) {
      if (!visible(el)) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 17.5) push('heading', `${el.tagName.toLowerCase()} is ${size}px`)
    }

    const families = new Set<string>()
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || !(el.textContent || '').trim()) continue
      const first = getComputedStyle(el).fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
      if (!first || genericFonts.includes(first)) continue
      families.add(first)
    }

    let copy = ''
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement
      if (!parent || parent.closest('option, script, style, [data-testid="shell-look"], [data-testid="course-home"], details:not([open])')) continue
      copy += `${walker.currentNode.textContent}\n`
    }
    const images: string[] = []
    const colours: string[] = []
    const banned = new Set(['rgb(15, 59, 58)', 'rgb(31, 77, 58)', 'rgb(224, 122, 95)', 'rgb(212, 168, 75)', 'rgb(224, 177, 90)'])
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue
      const cs = getComputedStyle(el)
      const bg = `${cs.backgroundImage} ${el.getAttribute('src') || ''}`
      if (/evening-courtyard|lattice\.svg/i.test(bg)) images.push(bg.slice(0, 120))
      const rect = el.getBoundingClientRect()
      if (rect.width * rect.height > 8000 && banned.has(cs.backgroundColor)) colours.push(`${cs.backgroundColor} ${el.tagName.toLowerCase()}.${el.className}`)
    }

    const doc = document.documentElement
    const wide: string[] = []
    if (doc.scrollWidth > doc.clientWidth + 2) {
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8 || rect.right <= window.innerWidth + 2) continue
        wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 48)} right ${Math.round(rect.right)}`)
        if (wide.length >= 4) break
      }
    }
    return {
      found,
      families: [...families],
      copy,
      images: images.slice(0, 6),
      colours: colours.slice(0, 6),
      scroll: doc.scrollWidth > doc.clientWidth + 2,
      wide,
      talks: [...document.querySelectorAll('[data-testid="buffet-talk"] .talk-name, [data-testid="part-link"]')].map((el) => (el.textContent || '').trim()).filter(Boolean),
    }
  }, { heartsFonts: [...HEARTS_FONTS], genericFonts: [...GENERIC_FONTS] })

  for (const hit of dom.found) hits.push({ screen, kind: hit.kind, detail: hit.detail })
  if (portal === 'hady') {
    if (dom.families.length > 2) hits.push({ screen, kind: 'fonts', detail: dom.families.join(', ') })
  } else {
    const extra = dom.families.filter((name) => !HEARTS_FONTS.has(name))
    if (extra.length) hits.push({ screen, kind: 'fonts', detail: `outside the evening set: ${extra.join(', ')}` })
  }
  if (portal === 'hady') {
    const banned = [/HEARTS/i, /\bIslam\b/i, /\bIman\b/i, /\bIhsan\b/i, /Jibril/i, /hadith/i, /masjid/i, /mosque/i, /ghunya/i, /donations/i, /appetiser/i, /Five ways to see it/i, /See what you've sown/i]
    for (const pattern of banned) {
      const match = dom.copy.match(pattern)
      if (match) hits.push({ screen, kind: 'hearts-copy', detail: match[0] })
    }
    for (const image of dom.images) hits.push({ screen, kind: 'hearts-image', detail: image })
    for (const colour of dom.colours) hits.push({ screen, kind: 'hearts-colour', detail: colour })
  }
  if (dom.scroll) hits.push({ screen, kind: 'horizontal-scroll', detail: `page is wider than the viewport${dom.wide?.length ? `: ${dom.wide.join(' | ')}` : ''}` })

  const empty = await page.evaluate(() => {
    const notes: string[] = []
    for (const el of document.querySelectorAll('section, .card, .panel')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 8 || rect.bottom < 0 || rect.top > window.innerHeight) continue
      const heading = el.querySelector('h1, h2, h3')
      if (!heading) continue
      const rest = (el.textContent || '').replace(heading.textContent || '', '').trim()
      if (rest) continue
      if (el.querySelector('img, svg, video, canvas, iframe, button, a, input, textarea, select')) continue
      notes.push((heading.textContent || '').trim().slice(0, 80))
    }
    return notes.slice(0, 6)
  })
  for (const note of empty) hits.push({ screen, kind: 'empty', detail: note })

  try {
    const axe = await new AxeBuilder({ page }).options({ runOnly: { type: 'rule', values: ['color-contrast'] } }).analyze()
    for (const violation of axe.violations) {
      const sample = violation.nodes[0]
      const where = `${sample?.target?.join(' ') || ''} ${sample?.html || violation.help}`
      hits.push({ screen, kind: 'contrast', detail: where.slice(0, 180) })
      if (hits.filter((hit) => hit.kind === 'contrast').length >= 6) break
    }
  } catch (error) {
    hits.push({ screen, kind: 'contrast', detail: error instanceof Error ? error.message : 'axe failed' })
  }
  return hits
}

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined)
  if (info.project.name === 'chromium-phone') {
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: path.join(SHOTS, `visual-${name}.png`), caret: 'hide', animations: 'disabled' })
  }
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: [page.locator('iframe, video, nextjs-portal')],
  })
}

async function visit(page: Page, info: TestInfo, portal: 'hady' | 'hearts', name: string, url: string, hits: Hit[]) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(async (error: unknown) => {
    if (!/interrupted/i.test(String(error))) throw error
    return page.goto(url, { waitUntil: 'domcontentloaded' })
  })
  await settle(page)
  if (response && response.status() >= 400) hits.push({ screen: name, kind: 'http', detail: String(response.status()) })
  const found = await audit(page, name, portal)
  hits.push(...found)
  if (portal === 'hady' && name.endsWith('course')) {
    const titles = sheetTitles()
    const talks = await page.locator('[data-testid="buffet-talk"] .talk-name').allTextContents()
    let cursor = 0
    for (const talk of talks.map((talk) => talk.trim()).filter(Boolean)) {
      const wanted = norm(talk)
      const at = titles.findIndex((title, index) => index >= cursor && (norm(title).includes(wanted) || wanted.includes(norm(title))))
      if (at < 0) hits.push({ screen: name, kind: 'order', detail: talk.slice(0, 120) })
      else cursor = at + 1
    }
    if (!talks.length) hits.push({ screen: name, kind: 'order', detail: 'no films listed' })
  }
  await shoot(page, info, name)
  remember(info, name, hits.filter((hit) => hit.screen === name))
}

test.describe.configure({ timeout: 600_000 })

test('Hady Home learner screens', async ({ page }, info) => {
  const hits: Hit[] = []
  try {
    await signIn(page, 'parenting-learner@hearts.test', 'portal-learner', '/p/parenting')
    await page.goto('/p/parenting/start', { waitUntil: 'domcontentloaded' })
    await settle(page)
    const play = page.getByTestId('lets-play')
    if (await play.count()) {
      await play.click()
      const shown = await page.getByTestId('progress').waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)
      if (!shown) {
        await play.click()
        await page.getByTestId('progress').waitFor({ timeout: 15_000 })
      }
    } else {
      await page.getByTestId('progress').waitFor({ timeout: 15_000 })
    }
    await settle(page)
    const progress = ((await page.getByTestId('progress').textContent()) || '').replace(/\s+/g, ' ').trim()
    if (progress !== '1 of 8') hits.push({ screen: 'hady-learner-opening', kind: 'order', detail: `counter is “${progress}”` })
    const openingHits = await audit(page, 'hady-learner-opening', 'hady')
    hits.push(...openingHits)
    await shoot(page, info, 'hady-learner-opening')
    remember(info, 'hady-learner-opening', openingHits)
    for (const [name, url] of HADY_LEARNER) await visit(page, info, 'hady', `hady-learner-${name}`, url, hits)
    const href = await page.goto('/p/parenting/courses').then(() => page.getByTestId('course-card').first().getAttribute('href'))
    if (!href) hits.push({ screen: 'hady-learner-course', kind: 'order', detail: 'no course card' })
    else {
      await visit(page, info, 'hady', 'hady-learner-course', href, hits)
      const start = page.getByTestId('start-part')
      if (await start.count()) await start.click()
      await page.waitForURL(/part=/, { timeout: 60_000 }).catch(() => undefined)
      await settle(page)
      const question = page.getByTestId('sequence-question')
      if (await question.count()) {
        await question.scrollIntoViewIfNeeded()
        await settle(page)
        const questionHits = await audit(page, 'hady-learner-question', 'hady')
        hits.push(...questionHits)
        if (info.project.name === 'chromium-phone') {
          mkdirSync(SHOTS, { recursive: true })
          await page.screenshot({ path: path.join(SHOTS, 'visual-hady-learner-question.png'), caret: 'hide', animations: 'disabled' })
        }
        await expect(page).toHaveScreenshot('hady-learner-question.png', { mask: [page.locator('iframe, video, nextjs-portal')] })
        remember(info, 'hady-learner-question', questionHits)
      } else hits.push({ screen: 'hady-learner-question', kind: 'empty', detail: 'opening question missing' })
    }
  } finally {
    remember(info, '_summary', hits)
  }
  expect(hits, hits.map((hit) => `${hit.screen} ${hit.kind}: ${hit.detail}`).join('\n')).toEqual([])
})

test('Hady Home admin screens', async ({ page }, info) => {
  const hits: Hit[] = []
  try {
    await signIn(page, 'parenting-admin@hearts.test', 'portal-admin', '/p/parenting/admin')
    for (const [name, url] of HADY_ADMIN) await visit(page, info, 'hady', `hady-admin-${name}`, url, hits)
  } finally {
    remember(info, '_summary', hits)
  }
  expect(hits, hits.map((hit) => `${hit.screen} ${hit.kind}: ${hit.detail}`).join('\n')).toEqual([])
})

test('HEARTS learner screens', async ({ page }, info) => {
  const hits: Hit[] = []
  try {
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    for (const [name, url] of HEARTS_LEARNER) await visit(page, info, 'hearts', `hearts-learner-${name}`, url, hits)
    await page.goto('/p/east-london/courses')
    const href = await page.getByTestId('course-card').first().getAttribute('href')
    if (href) await visit(page, info, 'hearts', 'hearts-learner-course', href, hits)
    const labels = await page.locator('[data-testid="part-link"], [data-testid="buffet-talk"] .talk-name').allTextContents()
    const numbers = labels.map((label) => Number(/^(\d+)\./.exec(label.trim())?.[1] || 0)).filter((n) => n > 0)
    for (let i = 0; i < numbers.length; i++) {
      if (numbers[i] !== i + 1) hits.push({ screen: 'hearts-learner-course', kind: 'order', detail: `expected ${i + 1}, saw ${numbers[i]}` })
    }
  } finally {
    remember(info, '_summary', hits)
  }
  expect(hits, hits.map((hit) => `${hit.screen} ${hit.kind}: ${hit.detail}`).join('\n')).toEqual([])
})

/** Same-row chips share a height, a centred text block, the same left padding, and icons only when every chip has one. */
async function chipProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.querySelector('.j-scene-wrap:not(.leaving)') || document
    const tiles = [...root.querySelectorAll('[data-testid="tile"]')].filter((el) => {
      const rect = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return rect.width > 20 && rect.height > 20 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0
    })
    if (tiles.length < 2) problems.push('missing chips')
    const rows = new Map<number, Element[]>()
    for (const tile of tiles) {
      const top = Math.round(tile.getBoundingClientRect().top)
      const key = [...rows.keys()].find((row) => Math.abs(row - top) < 12) ?? top
      const list = rows.get(key) || []
      list.push(tile)
      rows.set(key, list)
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue
      const heights = row.map((el) => Math.round(el.getBoundingClientRect().height))
      const chipTops = row.map((el) => Math.round(el.getBoundingClientRect().top))
      const pads = row.map((el) => getComputedStyle(el).paddingLeft)
      const icons = row.map((el) => el.querySelectorAll('svg').length)
      if (Math.max(...heights) - Math.min(...heights) > 1) problems.push(`height ${heights.join(',')}`)
      if (Math.max(...chipTops) - Math.min(...chipTops) > 1) problems.push(`row ${chipTops.join(',')}`)
      if (new Set(pads).size > 1) problems.push(`padding ${pads.join(',')}`)
      if (icons.some((count) => count > 0) && icons.some((count) => count === 0)) problems.push('lone icon')
      const lineBoxes = row.map((el) => {
        const text = [...el.querySelectorAll(':scope > span')].find((span) => !span.classList.contains('j-glyph'))
        if (!text) return []
        const range = document.createRange()
        range.selectNodeContents(text)
        return [...range.getClientRects()]
      })
      for (const el of row) {
        const text = [...el.querySelectorAll(':scope > span')].find((span) => !span.classList.contains('j-glyph'))
        if (!text) {
          problems.push('missing label')
          continue
        }
        const box = el.getBoundingClientRect()
        const words = text.getBoundingClientRect()
        const mid = (words.top + words.bottom) / 2
        const chip = (box.top + box.bottom) / 2
        if (Math.abs(mid - chip) > 2) problems.push(`baseline ${el.getAttribute('data-option')} off by ${Math.abs(mid - chip).toFixed(1)}`)
      }
      if (lineBoxes.every((lines) => lines.length === lineBoxes[0].length) && lineBoxes[0].length > 0) {
        const tops = lineBoxes.map((lines) => Math.round(lines[0].top))
        if (Math.max(...tops) - Math.min(...tops) > 2) problems.push(`baseline ${tops.join(',')}`)
      }
    }
    return problems
  })
}

/** The question, chips and link sit as one group, and ? matches Skip. */
async function questionRhythm(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.querySelector('.j-scene-wrap:not(.leaving)')
    const body = root?.querySelector('.j-body')
    const tile = root?.querySelector('[data-testid="tile"]')
    const link = root?.querySelector('[data-testid="just-show"]')
    const skip = root?.querySelector('[data-testid="pass"]')
    const help = document.querySelector('[data-testid="page-help-open"]')
    const header = root?.querySelector('.j-top')
    if (!body || !tile || !link || !skip || !help || !header) {
      problems.push('missing question parts')
      return problems
    }
    const gap = tile.getBoundingClientRect().top - body.getBoundingClientRect().bottom
    const below = window.innerHeight - link.getBoundingClientRect().bottom
    const above = body.getBoundingClientRect().top - header.getBoundingClientRect().bottom
    if (gap > 72) problems.push(`gap ${Math.round(gap)}`)
    if (gap < 4) problems.push(`tight ${Math.round(gap)}`)
    if (below > window.innerHeight * 0.42) problems.push(`below ${Math.round(below)}`)
    if (above > window.innerHeight * 0.42) problems.push(`above ${Math.round(above)}`)
    const skipStyle = getComputedStyle(skip)
    const helpStyle = getComputedStyle(help)
    const skipH = Math.round(skip.getBoundingClientRect().height)
    const helpH = Math.round(help.getBoundingClientRect().height)
    if (Math.abs(skipH - helpH) > 8) problems.push(`help height ${helpH} skip ${skipH}`)
    if (helpStyle.fontWeight !== skipStyle.fontWeight) problems.push(`weight help ${helpStyle.fontWeight} skip ${skipStyle.fontWeight}`)
    const helpBg = helpStyle.backgroundColor
    const clear = helpBg === 'transparent' || /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(helpBg)
    if (!clear) {
      const parts = helpBg.match(/\d+/g)?.slice(0, 3).map(Number) || [0, 0, 0]
      const lum = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
      if (lum < 0.85) problems.push(`help fill ${helpBg}`)
    }
    return problems
  })
}

async function contrastProblems(page: Page) {
  const axe = await new AxeBuilder({ page }).options({ runOnly: { type: 'rule', values: ['color-contrast'] } }).analyze()
  return axe.violations.map((violation) => {
    const node = violation.nodes[0]
    return `${violation.help}: ${(node?.target || []).join(' ')} ${(node?.html || '').slice(0, 140)}`
  })
}

test('signed-out first visit', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-phone', 'iPhone WebKit is the signed-out gate')
  await page.context().clearCookies()
  await page.goto('/p/parenting', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/start/, { timeout: 60_000 })
  await settle(page)
  const play = page.getByTestId('lets-play')
  await play.click()
  const shown = await page.getByTestId('progress').waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)
  if (!shown) {
    await play.click()
    await page.getByTestId('progress').waitFor({ timeout: 15_000 })
  }
  for (let step = 1; step <= 8; step += 1) {
    await expect(page.getByTestId('progress')).toHaveText(`${step} of 8`)
    await settle(page)
    const chips = await chipProblems(page)
    expect(chips, chips.join('\n')).toEqual([])
    const rhythm = await questionRhythm(page)
    expect(rhythm, rhythm.join('\n')).toEqual([])
    const contrast = await contrastProblems(page)
    expect(contrast, contrast.join('\n')).toEqual([])
    await page.getByTestId('tile').first().click()
  }
  await page.waitForURL(/\/course\/\d+/, { timeout: 20_000 })
  await expect(page.getByTestId('course')).toBeVisible()
  await expect(page.getByTestId('vimeo-player')).toBeVisible()
  await expect(page.getByTestId('question-strip')).toBeVisible()
  await expect(page.getByTestId('sequence-question')).toBeVisible()
  await expect(page.getByTestId('garden-next')).toBeVisible()
  await expect(page.getByTestId('film-share-link')).toBeVisible()
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  await page.getByTestId('answer-point').click()
  await expect(page.getByTestId('popup-prompt')).toBeVisible()
  const note = 'We watch in the evening'
  await page.getByTestId('answer-text').fill(note)
  await page.getByTestId('answer-private').uncheck()
  await page.getByTestId('answer-share').check()
  await page.getByTestId('answer-submit').click()
  await expect(page.getByTestId('keep-sheet')).toBeVisible()
  await page.getByTestId('not-now').click()
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  const kept = await page.evaluate(() => ({
    heart: JSON.parse(window.localStorage.getItem('hearts.heart.v1') || '{}') as { taps?: { option?: string }[] },
    guest: JSON.parse(window.localStorage.getItem('hearts.guest.v1') || '{}') as { answers?: { body?: string; shareWithTeacher?: boolean }[] },
  }))
  expect((kept.heart.taps || []).filter((tap) => tap.option && tap.option !== 'pass').length).toBeGreaterThan(0)
  expect(kept.guest.answers?.[0]?.body).toBe(note)
  expect(kept.guest.answers?.[0]?.shareWithTeacher).toBe(true)
  await expect(page).not.toHaveURL(/\/login/)
  await page.getByTestId('sequence-back').click()
  await page.waitForURL(/\/course\/\d+$/, { timeout: 60_000 })
  await expect(page.getByTestId('sequence-module').first()).toBeVisible()
  await expect(page.getByTestId('buffet-talk').nth(1)).toBeVisible()
  await page.getByTestId('tab-week').click()
  await page.waitForURL(/\/week$/, { timeout: 60_000 })
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'My week' })).toBeVisible()
  await expect(page.getByTestId('week-continue')).toBeVisible()
  await page.getByTestId('tab-me').click()
  await page.waitForURL(/\/me$/, { timeout: 60_000 })
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Me' })).toBeVisible()
  await expect(page.getByTestId('guest-saved-answer')).toContainText(note)
  await expect(page.getByTestId('guest-opening')).not.toHaveText('0 opening answers saved')
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  await page.getByTestId('keep-offer').click()
  await expect(page.getByTestId('keep-sheet')).toBeVisible()
  await expect(page.getByTestId('sheet-copy')).toContainText('already on this phone')
  await expect(page.getByRole('heading', { name: 'Me' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
  const sheet = await page.evaluate(() => {
    const lum = (value: string) => {
      const parts = value.match(/\d+/g)?.slice(0, 3).map(Number) || [0, 0, 0]
      return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
    }
    const card = document.querySelector('[data-testid="keep-sheet"]')
    const title = document.querySelector('[data-testid="keep-title"]')
    return {
      card: lum(getComputedStyle(card || document.body).backgroundColor),
      title: lum(getComputedStyle(title || document.body).color),
    }
  })
  expect(sheet.card).toBeGreaterThan(0.9)
  expect(sheet.title).toBeLessThan(0.25)
  const sheetContrast = await contrastProblems(page)
  expect(sheetContrast, sheetContrast.join('\n')).toEqual([])
  await page.getByTestId('not-now').click()
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Me' })).toBeVisible()
  await page.getByTestId('tab-garden').click()
  await page.waitForURL(/\/courses$/, { timeout: 60_000 })
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByTestId('course-home')).toBeVisible()
  await expect(page.getByTestId('course-card').first()).toBeVisible()
  const coursesContrast = await contrastProblems(page)
  expect(coursesContrast, coursesContrast.join('\n')).toEqual([])
})

test('HEARTS admin screens', async ({ page }, info) => {
  const hits: Hit[] = []
  try {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
    for (const [name, url] of HEARTS_ADMIN) await visit(page, info, 'hearts', `hearts-admin-${name}`, url, hits)
  } finally {
    remember(info, '_summary', hits)
  }
  expect(hits, hits.map((hit) => `${hit.screen} ${hit.kind}: ${hit.detail}`).join('\n')).toEqual([])
})
