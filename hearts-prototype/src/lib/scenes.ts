/**
 * Scenic stills for the teaching cards. No people, and no figurative figures.
 * Desert, sky and mountain are original pictures made for this set.
 * Road, mist and night are the stills already used behind the teaching slides.
 */
export const SCENES = [
  { id: 'road', src: '/slides/bg-cinema-road.jpg' },
  { id: 'mist', src: '/slides/bg-windows-mist.jpg' },
  { id: 'night', src: '/slides/bg-conversation-night.jpg' },
  { id: 'desert', src: '/slides/bg-desert.jpg' },
  { id: 'sky', src: '/slides/bg-sky.jpg' },
  { id: 'mountain', src: '/slides/bg-mountain.jpg' },
] as const

export type SceneId = (typeof SCENES)[number]['id']

export function sceneById(id: string) {
  return SCENES.find((scene) => scene.id === id) || SCENES[0]
}

/** Move along the set, and step past a scene that the previous card already used. */
export function pickScene(index: number, visit: number, previous: string, base = 0) {
  const count = SCENES.length
  let at = (base + visit + index) % count
  if (SCENES[at].id === previous) at = (at + 1) % count
  return SCENES[at]
}
