/** A signed-in person who still has a temporary password must open the change page before any other screen. */
export function forcedPasswordDestination(
  user: { mustChangePassword?: boolean | null } | null | undefined,
  path: string,
): '/change-password' | null {
  if (!user?.mustChangePassword) return null
  if (path.startsWith('/change-password')) return null
  return '/change-password'
}
