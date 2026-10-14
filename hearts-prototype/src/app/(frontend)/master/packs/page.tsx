import { redirect } from 'next/navigation'

/** Course packs are no longer a desk page. Old links land on the library. */
export default function Packs() {
  redirect('/master/library')
}
