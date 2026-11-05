const RATES = [1, 1.25, 1.5, 2]

/** The feed and the lecture share one speed ladder, and 2× is on it. */
export function nextPlaybackRate(current: number) {
  const index = RATES.findIndex((rate) => Math.abs(rate - current) < 0.01)
  if (index < 0 || index === RATES.length - 1) return 1
  return RATES[index + 1]
}
