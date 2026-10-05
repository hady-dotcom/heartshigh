# Lane D integrator notes

Other lanes and the delete-and-wipe builder.

## Clash-owned files this lane changed

- `src/payload.config.ts` — registers `collections-admin.ts`, audit hooks, class join hook, multi-tenant `classes` and `class-join-rules`.
- `src/screens/desk/shell.tsx` — nav is now Beginner / Intermediate / In-depth. New keys: `classes`, `activity`, `people` (master), `system`.
- `src/server/handle.ts` — one dispatch line at the top of `handleForm`, calling `handleAdminActions` (Lane D). Leave room above it for A, B, C in that order.
- `src/migrations/index.ts` — `20261005_010000_admin_ops` only. Do not hand-merge types; regenerate after each lane merge.
- `src/lib/desk-help.ts` — new PAGE/TOOL keys only.

Lane A may add `email: emailAdapter()` to `payload.config.ts`. Merge A first if both touch the config object.

## New collections (register with the erase registry)

The erase registry (`src/server/erase/`) was **not** on this base (`cursor/portal-features-0777`). Please add:

| Collection | On wipe of a user | On wipe of a portal |
|---|---|---|
| `classes` | Remove the person from `learners` / `teachers`. Do not delete the class. | Delete the class (portal-scoped). |
| `class-join-rules` | Nothing (points at a code, not a person). | Delete rules for that portal. |
| `ops-events` | Nothing. | Drop `portal` to null; keep backup/restore rows. |
| `audit-log` (existing) | Call `pseudonymiseAuditForUser(payload, userId)` from `src/server/audit.ts`. Keep the event. | Keep rows; they answer “who did this?”. |

Also call `audit(payload, event, { actor, target, portal, reason, detail })` from `src/server/audit.ts` for deletes and wipes. Do not write a second logger.

**Trash (C15) versus wipe:** trash is a short grace period on content (courses, talks, codes, packs). Personal-data wipes skip the trash and run the full erase. If both land, wipe first, then empty trash for that portal.

## Helper other lanes should call

```ts
import { audit } from '@/server/audit'
// or the old path, which re-exports it:
import { audit } from '@/server/viewas'

await audit(payload, 'users.role', { actor: user, target: person, portal, reason, detail: { fields: ['role'] } })
```

Until this branch merges, other lanes may keep calling `audit` from `viewas.ts`. After merge, prefer `server/audit.ts`. Never store answer text or passwords in `detail`.

## C15 trash

Built last, in its own files. Payload `trash: true` is applied from `payload.config.ts` for the listed collections, **not** by editing `collections.ts` (A owns Users, C owns Media). After A and C merge, you may also set `trash: true` on those collection configs if you want the flag next to the fields.

Personal wipes must pass a hard delete (skip trash).
