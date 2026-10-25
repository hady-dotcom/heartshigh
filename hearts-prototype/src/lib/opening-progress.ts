/** Opener is step 1; each served scene is the next step. */

export function openingStepTotal(sceneCount: number) {
  return Math.max(1, sceneCount + 1)
}

export function openingStepLabel(step: number, sceneCount: number) {
  return `${step} of ${openingStepTotal(sceneCount)}`
}

/** Question screens count the questions only. The opener is not question 1. */
export function questionStepLabel(index: number, total: number) {
  const count = Math.max(1, total)
  const step = Math.min(count, Math.max(1, index + 1))
  return `${step} of ${count}`
}
