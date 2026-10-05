/** Keys HEARTS writes on the device. Listed in the privacy notice (L05). */

export const HEARTS_LOCAL_KEYS = [
  'hearts.heart.v1',
  'hearts.pending.v1',
  'hearts.saved.v1',
  'hearts.faves.v1',
  'hearts.trends.v1',
  'hearts.theme',
  'hearts.install.dismissed',
  'hearts.install.installed',
  'hearts.cardVoice',
  'hearts.viewas.active',
] as const

export const HEARTS_SESSION_KEYS = ['hearts.session.v1', 'hearts.saved.toast'] as const

export const HEARTS_COOKIE_NAMES = ['hearts_opened'] as const

export const HEARTS_PREF_PREFIX = 'hearts.pref.'

export const HEARTS_CAPTION_KEY = 'hearts.captions.v1'

export type StorageRow = { name: string; where: 'Cookie' | 'Local storage' | 'Session storage'; why: string; needed: boolean }

export function storageNoticeRows(): StorageRow[] {
  return [
    {
      name: 'Payload session cookie',
      where: 'Cookie',
      why: 'Keeps you signed in. HttpOnly, SameSite Lax. It is strictly necessary.',
      needed: true,
    },
    {
      name: 'hearts_opened',
      where: 'Cookie',
      why: 'Remembers that you have seen the opening, so the next visit can go to the feed.',
      needed: true,
    },
    {
      name: 'hearts.heart.v1',
      where: 'Local storage',
      why: 'The taps you made in the opening, kept on this phone.',
      needed: true,
    },
    {
      name: 'hearts.pending.v1',
      where: 'Local storage',
      why: 'Answers written before you signed in, waiting to save.',
      needed: true,
    },
    {
      name: 'hearts.saved.v1 and hearts.faves.v1',
      where: 'Local storage',
      why: 'Talks you saved or liked on this phone.',
      needed: true,
    },
    {
      name: 'hearts.theme',
      where: 'Local storage',
      why: 'Whether you pinned day or evening on this phone.',
      needed: true,
    },
    {
      name: 'hearts.pref.*',
      where: 'Local storage',
      why: 'Quiet opt-in lanes, kept on this phone and never sent as a name.',
      needed: true,
    },
    {
      name: 'hearts.captions.v1',
      where: 'Local storage',
      why: 'Whether you last had our own captions on.',
      needed: true,
    },
    {
      name: 'hearts.session.v1',
      where: 'Session storage',
      why: 'A short key for this browser tab, so two tabs do not mix.',
      needed: true,
    },
    {
      name: 'YouTube nocookie player',
      where: 'Cookie',
      why: 'The film player may set its own cookies on youtube-nocookie.com when a talk plays.',
      needed: true,
    },
    {
      name: 'Cloudflare Turnstile',
      where: 'Cookie',
      why: 'A short check on the sign-in and join doors so a bot cannot fill them.',
      needed: true,
    },
  ]
}
