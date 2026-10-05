import { getSession } from '@/server/context'
import { LegalScreen } from '@/screens/app/legal'

export default async function GuidelinesPage() {
  const { payload } = await getSession()
  return LegalScreen({ payload, base: '' }, 'guidelines')
}
