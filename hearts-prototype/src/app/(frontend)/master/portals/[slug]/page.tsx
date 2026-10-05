import { requireMaster } from '@/server/context'
import { PortalEditScreen } from '@/screens/desk/portal-studio-screen'

export default async function EditPortal({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  return PortalEditScreen({ payload, user, query }, slug)
}
