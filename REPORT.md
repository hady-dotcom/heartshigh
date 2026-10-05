# S05 type-fix — live deploy unblock

Urgent follow-up to [PR #38](https://github.com/hady-dotcom/heartshigh/pull/38) (`a366ecb`). Railway production `next build` failed, so live stayed on `8ad0b33`. S05 is still open: same-portal learners get 200 on others' private answer media.

Draft PR: https://github.com/hady-dotcom/heartshigh/pull/42  
Code branch: `cursor/s05-type-fix-live-unblock-b07e` @ `231abf0`  
Base: `cursor/hearts-prototype-v1-cf40` @ `a366ecb`

## Cause (reproduced)

`npx tsc --noEmit` on `a366ecb` exits 2:

```
src/collections.ts(201,7): error TS2322: Type '({ req, id }: AccessArgs<any>) => false | { purpose: { in: string[]; }; id?: undefined; and?: undefined; } | { id: { equals: number; }; purpose?: undefined; and?: undefined; } | { and: … } | Promise<…>' is not assignable to type 'Access'.
  Type '{ purpose: { in: string[]; }; id?: undefined; and?: undefined; }' is not assignable to type 'Where'.
    Property 'id' is incompatible with index signature.
      Type 'undefined' is not assignable to type 'Where[] | WhereField'.
```

`mediaListWhere` returned three different object shapes. TypeScript widens that union onto optional keys (`id?: undefined`). Payload’s `Where` index signature is `[key: string]: Where[] | WhereField` and does not allow `undefined`. Docker `npm run build` / `next build` type-checks and exits 1.

Full log: [tsc-before.txt](./tsc-before.txt)

## Fix

Types only. S05 behaviour is unchanged.

1. `mediaListWhere` now returns Payload `Where` explicitly. Each branch is checked on its own, so the union never grows optional `undefined` keys. Portal-scoped list clauses share one `and` shape (`purpose` is `portal-asset`/`film` for learners; staff also get `gather-photo`).
2. `mediaReadAccess` is a normal `async` `Access` function. Same checks: signed-out → false; list → `mediaListWhere`; by id → linked answer + `canReadMedia`.

No preview change. No new env. No migration.

## Proof

| Check | Before (`a366ecb`) | After (`231abf0`) |
| --- | --- | --- |
| `npx tsc --noEmit` | exit 2, TS2322 on `mediaReadAccess` | exit 0, no diagnostics |
| `HEARTS_BUILD=1 npm run build` (Dockerfile / Railway) | fails typecheck | exit 0, compiled + types passed |
| S05 unit (`src/lib/media-access.test.ts`) | 6 pass | 6 pass |
| Full unit | 326 pass (from PR #38) | 326 pass / 0 fail |

- [tsc-after.txt](./tsc-after.txt)
- [next-build.txt](./next-build.txt)
- [unit-media-access.txt](./unit-media-access.txt)
- [build-proof.json](./build-proof.json)

S05 rules still hold in unit tests:

- other learner cannot read private answer media
- owner can
- teacher blocked until `shareWithTeacher`, then allowed
- `portal-asset` and `film` stay readable to portal members
- listing never includes answer files
- signed-out users read no Media rows (theme/clips/speakers/slides are not Media and stay on disk)

## Deploy

Merge PR #42 into `cursor/hearts-prototype-v1-cf40`, then let Railway rebuild. That ships the #38 privacy fix that never reached live because the image failed to compile.
