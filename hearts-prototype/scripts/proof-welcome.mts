import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT = path.resolve('artifacts/hady-core-welcome')
mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:3100'
const code = JSON.parse(readFileSync('data/seed-codes-test.json', 'utf8')) as { 'elm-learner': string }

const browser = await chromium.launch()
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const d = await desk.newPage()
await d.goto(`${BASE}/login?next=${encodeURIComponent('/p/east-london/admin/settings')}`)
await d.getByTestId('login-email').fill('elm-admin@hearts.test')
await d.getByTestId('login-password').fill('portal-admin')
await d.getByTestId('login-submit').click()
await d.getByTestId('admin-settings').waitFor()
await d.getByTestId('welcome-film-slots').scrollIntoViewIfNeeded()
await d.screenshot({ path: path.join(OUT, 'desk_welcome_slots.png'), fullPage: true })
await d.getByTestId('learner-welcome-slot').getByTestId('desk-help').click()
await d.getByTestId('desk-help-pop').waitFor()
await d.screenshot({ path: path.join(OUT, 'desk_welcome_help.png'), fullPage: true })
await d.keyboard.press('Escape')
await desk.close()

const master = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const m = await master.newPage()
await m.goto(`${BASE}/login?next=/master`)
await m.getByTestId('login-email').fill('master@hearts.test')
await m.getByTestId('login-password').fill('hearts-master')
await m.getByTestId('login-submit').click()
await m.getByTestId('master').waitFor()
await m.screenshot({ path: path.join(OUT, 'desk_hady_core_name.png') })
await master.close()

const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
const p = await phone.newPage()
const email = `proof-${Date.now().toString().slice(-6)}@hearts.test`
await p.goto(`${BASE}/join?code=${code['elm-learner']}`)
await p.getByTestId('join-name').fill('Proof Learner')
await p.getByTestId('join-email').fill(email)
await p.getByTestId('join-password').fill('proof-learner')
await p.getByTestId('join-submit').click()
await p.getByTestId('welcome-films').or(p.getByTestId('splash')).waitFor()
if (await p.getByTestId('welcome-begin').count()) await p.getByTestId('welcome-begin').click()
await p.getByTestId('welcome-films').waitFor()
await p.screenshot({ path: path.join(OUT, 'first_login_welcome.png') })
await p.getByTestId('welcome-skip').click()
await p.getByTestId('welcome-intro').waitFor()
await p.screenshot({ path: path.join(OUT, 'first_login_intro_skip.png') })
await p.getByTestId('welcome-skip').click()
await p.waitForURL(/\/p\/east-london/)
await p.screenshot({ path: path.join(OUT, 'after_skip_continue.png') })

const back = await phone.newPage()
await back.goto(`${BASE}/login?next=${encodeURIComponent('/p/east-london')}`)
await back.getByTestId('login-email').fill(email)
await back.getByTestId('login-password').fill('proof-learner')
await back.getByTestId('login-submit').click()
await back.waitForURL((url) => !url.pathname.startsWith('/login'))
await back.waitForTimeout(800)
await back.screenshot({ path: path.join(OUT, 'returning_user_skip.png') })

const join = await phone.newPage()
await join.goto(`${BASE}/join`)
await join.screenshot({ path: path.join(OUT, 'join_hady_core_name.png') })

await browser.close()
console.log('wrote shots to', OUT)
