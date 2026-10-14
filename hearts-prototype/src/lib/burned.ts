/** Lesson 31. A Short whose words are burned into the lower third of the picture. */
export const KNOWN_BURNED_IDS = ['MK5q_zMiX1g'] as const

/**
 * Heavy text in the lower third: many sharp horizontal changes, the shape of burned-in captions,
 * rather than a flat picture.
 */
export function heavyLowerThird(gray: Uint8Array, width: number, height: number) {
  if (width < 8 || height < 8 || gray.length < width * height) return false
  const top = Math.floor(height * 0.72)
  let edges = 0
  let samples = 0
  for (let y = top; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const delta = Math.abs(gray[y * width + x] - gray[y * width + x - 1])
      samples += 1
      if (delta > 48) edges += 1
    }
  }
  return samples > 40 && edges / samples > 0.08
}

export function burnedCandidate(youtubeId: string, lowerThirdHeavy: boolean) {
  return lowerThirdHeavy || (KNOWN_BURNED_IDS as readonly string[]).includes(youtubeId)
}
