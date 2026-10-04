import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { MasterReview, MasterReviewPopups } from '@/screens/desk/review'

export default async function Review({ params, searchParams }: { params: Promise<{ kind?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ kind = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  if (!kind.length) return MasterReview({ payload, user, query })
  if (kind.length === 1 && kind[0] === 'popups') return MasterReviewPopups({ payload, user, query })
  notFound()
}
