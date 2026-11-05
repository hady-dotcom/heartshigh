/** Host stays visible; the path is shortened in the middle when the box is tight. */
export function displayPortalAddress(raw: string, max = 42) {
  const text = raw.replace(/^https?:\/\//, '')
  const slash = text.indexOf('/')
  const host = slash < 0 ? text : text.slice(0, slash)
  const rest = slash < 0 ? '' : text.slice(slash)
  if (text.length <= max) return text
  if (!rest) return host
  const budget = Math.max(max - host.length - 1, 6)
  if (rest.length <= budget) return `${host}${rest}`
  const head = Math.max(2, Math.ceil((budget - 1) / 2))
  const tail = Math.max(2, budget - 1 - head)
  return `${host}${rest.slice(0, head)}…${rest.slice(-tail)}`
}
