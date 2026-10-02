export function idOf(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value)
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' ? id : id != null ? Number(id) : null
  }
  return null
}

export function portalIdOf(user: { tenants?: { tenant?: unknown }[] } | null | undefined): number | null {
  const row = user?.tenants?.[0]
  if (!row) return null
  return idOf(row.tenant)
}
