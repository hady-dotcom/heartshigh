import { getSession } from '@/server/context'
import { LegalScreen } from '@/screens/app/legal'

export default async function RunningPage() {
  const { payload } = await getSession()
  return LegalScreen({ payload, base: '' }, 'portal-agreement')
}
