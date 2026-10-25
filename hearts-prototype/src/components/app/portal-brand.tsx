import { createContext, type ReactNode } from 'react'

export type PortalBrandValue = { colour: string; accent: string; name: string }

export const PortalBrandContext = createContext<PortalBrandValue | null>(null)

export function PortalBrandProvider({ value, children }: { value: PortalBrandValue | null; children: ReactNode }) {
  return <PortalBrandContext.Provider value={value}>{children}</PortalBrandContext.Provider>
}
