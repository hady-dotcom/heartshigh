import Link from 'next/link'
import type { FeatureKey } from '@/lib/features'
import { unavailableCopy } from '@/lib/features'
import { AppFrame } from '@/components/app/shell'

export function FeatureUnavailable({
  base,
  feature,
  desk,
  brand,
}: {
  base: string
  feature?: FeatureKey
  desk?: boolean
  brand?: { colour: string; accent: string; name?: string } | null
}) {
  const copy = unavailableCopy(feature)
  return (
    <AppFrame testId="feature-unavailable" evening brand={brand}>
      <div className="splash">
        <div>
          <h1>{copy.title}</h1>
          <p data-testid="feature-unavailable-body">{copy.body}</p>
          <Link className="pill gold" href={desk ? `${base}/admin` : base} data-testid="feature-unavailable-home">
            {desk ? 'Back to the desk' : 'Back home'}
          </Link>
        </div>
      </div>
    </AppFrame>
  )
}
