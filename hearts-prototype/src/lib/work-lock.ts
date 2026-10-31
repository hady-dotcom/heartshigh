const tails = new Map<string, Promise<void>>()

/** One at a time for the same key. A second identical bring-in or sheet apply waits, then sees the first write. */
export async function withWorkLock<T>(key: string, job: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  let release: () => void = () => {}
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const chain = previous.then(() => current, () => current)
  tails.set(key, chain)
  await previous.catch(() => undefined)
  try {
    return await job()
  } finally {
    release()
    if (tails.get(key) === chain) tails.delete(key)
  }
}
