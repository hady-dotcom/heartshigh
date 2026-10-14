// Motion through the Web Animations API (spec 7A.2), so tests can read document.getAnimations().
// With reduced motion on, every movement becomes a 200 ms opacity crossfade (7A.8).

export const EASE = {
  enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  calm: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

export const T = { tap: 120, fade: 150, exit: 250, snap: 280, sheet: 350, scene: 400, calm: 600, grow: 900, reduced: 200 } as const

export function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

type Frames = Keyframe[]

/**
 * Runs an animation. Under reduced motion the keyframes are cut down to their opacity values (or a plain fade
 * when there are none) and the timing becomes 200 ms standard.
 */
export function animate(el: Element | null | undefined, frames: Frames, duration: number, easing: string, options: { delay?: number; fill?: FillMode; id?: string } = {}) {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null
  let keyframes = frames
  let time = duration
  let ease = easing
  if (reducedMotion()) {
    const fades = frames.map((frame) => ('opacity' in frame ? { opacity: frame.opacity } : null))
    keyframes = fades.every(Boolean) ? (fades as Frames) : [{ opacity: frames[0] && 'opacity' in frames[0] ? frames[0].opacity : 0.4 }, { opacity: 1 }]
    time = Math.min(duration, T.reduced)
    ease = EASE.standard
  }
  const animation = (el as HTMLElement).animate(keyframes, { duration: time, easing: ease, delay: options.delay || 0, fill: options.fill || 'both' })
  if (options.id) animation.id = options.id
  return animation
}

export const finished = (animation: Animation | null) => (animation ? animation.finished.catch(() => undefined) : Promise.resolve())

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
