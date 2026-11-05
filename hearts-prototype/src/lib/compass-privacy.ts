/** Proposed Compass privacy. Off until Leon decides. */

export const COMPASS_PRIVACY_FLAG = 'HEARTS_COMPASS_PRIVACY'

export function compassPrivacyOn() {
  return process.env[COMPASS_PRIVACY_FLAG] === '1'
}

export const COMPASS_DISCLOSURE = 'Only you see these answers. They help us choose your first talk.'
