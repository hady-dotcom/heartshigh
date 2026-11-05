import { requireMaster } from '@/server/context'
import { MasterQuestions } from '@/screens/desk/master'

export default async function Questions({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterQuestions({ payload, user, query })
}
