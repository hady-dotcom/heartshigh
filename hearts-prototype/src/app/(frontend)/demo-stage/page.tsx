import type { Metadata } from 'next'
import { DemoDoor } from './door'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hady Core Demo stage',
  description: 'A live four-screen walk-through. Practice data only.',
}

export default function DemoStagePage() {
  return <DemoDoor />
}
