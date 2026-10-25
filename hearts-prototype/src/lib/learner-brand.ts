import { accentOf, fontPairOf, sceneUrlOf, shellOf } from '@/lib/portal-look'

/** Colours, type, and the white shell. An empty name still keeps the HEARTS wordmark off. A HEARTS shell with no brand name stays on the evening theme. */
export function learnerBrand(portal: { brandName?: string | null; colour?: string | null; accent?: string | null; shell?: string | null; fontPair?: string | null; sceneKey?: string | null; sceneUrl?: string | null } | null | undefined) {
  if (!portal) return undefined
  const shell = shellOf(portal)
  const name = String(portal.brandName || '').trim()
  if (shell === 'hearts' && !name) return undefined
  return {
    colour: String(portal.colour || '#2563EB'),
    accent: accentOf(portal),
    name: name || undefined,
    shell,
    font: fontPairOf(portal),
    scene: shell === 'modern' && Boolean(sceneUrlOf(portal)),
  }
}

/** The name in install copy. HEARTS keeps its name. A modern portal uses its brand, or plain words when the name is still empty. */
export function appNameOf(portal: Parameters<typeof learnerBrand>[0]) {
  const brand = learnerBrand(portal)
  if (!brand || brand.shell === 'hearts') return 'HEARTS'
  return brand.name || 'this app'
}

/** A logo saved on the portal: a site path such as /icons/hady-home.svg, or an https link. */
export function portalLogo(value: unknown) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}
