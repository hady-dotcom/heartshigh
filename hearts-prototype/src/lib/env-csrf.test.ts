import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CSRF_E2E_IN_PRODUCTION, payloadCsrf, requestOriginAllowed } from './env'

describe('payload CSRF', () => {
  it('never switches off in production, even when HEARTS_E2E=1', () => {
    const origins = ['https://hearts.example']
    const warnings: string[] = []
    const csrf = payloadCsrf(origins, { NODE_ENV: 'production', HEARTS_E2E: '1' }, (message) => warnings.push(message))
    assert.deepEqual(csrf, origins)
    assert.equal(warnings.includes(CSRF_E2E_IN_PRODUCTION), true)
    assert.deepEqual(payloadCsrf(origins, { NODE_ENV: 'production' }), origins)
  })

  it('may stay off for Playwright when HEARTS_E2E=1 outside production', () => {
    assert.equal(payloadCsrf(['https://hearts.example'], { NODE_ENV: 'development', HEARTS_E2E: '1' }), undefined)
    assert.deepEqual(payloadCsrf(['https://hearts.example'], { NODE_ENV: 'development' }), ['https://hearts.example'])
    assert.equal(payloadCsrf([], { NODE_ENV: 'production' }), undefined)
  })

  it('refuses a cross-origin Origin on a state-changing request', () => {
    const headers = new Headers({
      origin: 'https://evil.example',
      host: '127.0.0.1:3100',
    })
    assert.equal(requestOriginAllowed(headers, { NODE_ENV: 'development', HEARTS_E2E: '1' }), false)
    assert.equal(requestOriginAllowed(new Headers({ host: '127.0.0.1:3100' }), { NODE_ENV: 'development', HEARTS_E2E: '1' }), true)
    assert.equal(
      requestOriginAllowed(new Headers({ origin: 'http://127.0.0.1:3100', host: '127.0.0.1:3100' }), { NODE_ENV: 'development', HEARTS_E2E: '1' }),
      true,
    )
    assert.equal(
      requestOriginAllowed(new Headers({ origin: 'https://evil.example', host: 'hearts.example' }), {
        NODE_ENV: 'production',
        SERVER_URL: 'https://hearts.example',
      }),
      false,
    )
  })
})
