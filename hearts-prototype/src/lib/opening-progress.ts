/** Opener is step 1; each served scene is the next step. */

export function openingStepTotal(sceneCount: number) {
  return Math.max(1, sceneCount + 1)
}

export function openingStepLabel(step: number, sceneCount: number) {
  return `${step} of ${openingStepTotal(sceneCount)}`
}
