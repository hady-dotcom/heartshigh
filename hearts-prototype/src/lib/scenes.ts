/**
 * Scenic stills for the teaching cards. No people, and no figurative figures.
 * Desert, sky and mountain are original pictures made for this set.
 * Road, mist and night are the stills already used behind the teaching slides.
 * Tags are how a larger catalogue (a few hundred stills) will avoid similar neighbours.
 */
export const SCENES = [
  { id: 'road', src: '/slides/bg-cinema-road.jpg', tags: ['road', 'day'] },
  { id: 'mist', src: '/slides/bg-windows-mist.jpg', tags: ['mist', 'pale'] },
  { id: 'night', src: '/slides/bg-conversation-night.jpg', tags: ['night', 'dark'] },
  { id: 'desert', src: '/slides/bg-desert.jpg', tags: ['desert', 'arid'] },
  { id: 'sky', src: '/slides/bg-sky.jpg', tags: ['sky', 'pale'] },
  { id: 'mountain', src: '/slides/bg-mountain.jpg', tags: ['mountain', 'high'] },
] as const

export type SceneId = (typeof SCENES)[number]['id']
export type SceneStill = (typeof SCENES)[number]

export function sceneById(id: string) {
  return SCENES.find((scene) => scene.id === id) || SCENES[0]
}

function sharesTag(scene: SceneStill, previous: { id: string; tags: readonly string[] }) {
  return scene.tags.some((tag) => previous.tags.includes(tag))
}

/**
 * Start from the card's own setting, then step a return visit along the catalogue.
 * Skip a neighbour that is the same still or shares a tag (pale with pale, and so on).
 */
export function pickScene(preferred: string, visit: number, previous: { id: string; tags: readonly string[] } | null) {
  const count = SCENES.length
  const start = Math.max(0, SCENES.findIndex((scene) => scene.id === preferred))
  const origin = (start + Math.max(0, visit)) % count
  if (!previous) return SCENES[origin]
  for (let step = 0; step < count; step++) {
    const scene = SCENES[(origin + step) % count]
    if (scene.id === previous.id || sharesTag(scene, previous)) continue
    return scene
  }
  for (let step = 0; step < count; step++) {
    const scene = SCENES[(origin + step) % count]
    if (scene.id !== previous.id) return scene
  }
  return SCENES[origin]
}
