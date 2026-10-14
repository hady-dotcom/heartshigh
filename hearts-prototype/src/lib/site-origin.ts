import { publicBaseURL } from './env'

export function requestOrigin(reqHeaders: Headers) {
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || ''
  if (!host) return ''
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** NEXT_PUBLIC_SITE_URL when it is a public host, otherwise the request host. */
export function shareOrigin(reqHeaders: Headers) {
  const request = requestOrigin(reqHeaders)
  return publicBaseURL(process.env, request) || request
}
