import { portalForClient } from '@/lib/portal-public'
import { TabBar as TabBarClient, type Tab } from './tab-bar'
import type { FeatureSource } from '@/lib/features'

/**
 * Server boundary in front of the client tab bar.
 * Screens pass the portal they already loaded. Only the fields the bar can render
 * cross into the browser. The AI connection never does.
 */
export function LearnerTabBar({
  portal,
  ...props
}: {
  base: string
  active?: Tab | null
  portal?: FeatureSource
  dark?: boolean
  evening?: boolean
  unread?: number
}) {
  return <TabBarClient {...props} portal={portalForClient(portal)} />
}
