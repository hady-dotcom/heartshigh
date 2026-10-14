import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkTurnstile, turnstileEnabled, turnstileToken, verifyTurnstile } from './turnstile'

const keys = { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_VERIFY_URL: 'https://verify.test' }

describe('Turnstile', () => {
  it('is off, and passes, when either key is missing', async () => {
    assert.equal(turnstileEnabled({}), false)
    assert.equal(turnstileEnabled({ TURNSTILE_SITE_KEY: 'only-site' }), false)
    const skipped = await verifyTurnstile('', null, {})
    assert.deepEqual(skipped, { ok: true, skipped: true })
    assert.equal(await checkTurnstile(null, null, {}), null)
  })

  it('reads the Cloudflare field and checks the token when both keys are set', async () => {
    const form = new FormData()
    form.set('cf-turnstile-response', 'tok-1')
    assert.equal(turnstileToken(form), 'tok-1')
    assert.equal(await checkTurnstile(form, '1.2.3.4', keys, async () => new Response('not-json')), 'Please confirm you are a person, then try again.')

    const ok = await verifyTurnstile('tok-1', '1.2.3.4', keys, async (url, init) => {
      assert.equal(String(url), 'https://verify.test')
      const body = String(init && 'body' in init ? init.body : '')
      assert.match(body, /secret=secret/)
      assert.match(body, /response=tok-1/)
      assert.match(body, /remoteip=1.2.3.4/)
      return new Response(JSON.stringify({ success: true }))
    })
    assert.deepEqual(ok, { ok: true })

    const refused = await verifyTurnstile('', null, keys)
    assert.equal(refused.ok, false)
  })
})
