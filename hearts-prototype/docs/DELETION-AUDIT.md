# Deletion audit

Written on 4 October 2026, from `cursor/portal-features-0777` (PR #30) before the wipe work. British English. This is what existed, not what we want.

Leon’s older system hid people in the UI and left their rows in the database. That caused real problems. This note lists every place a portal or a person is stored, so a wipe can take the rows, the join rows, the files and the sessions with them.

## What existed

There was no erase service, no `deleteUser`, no `deletePortal`, and no orphan check.

| Surface | What it did |
|---|---|
| Master desk portal list | **Deactivate** only (`action=deactivate`). The portal row stayed. People and answers stayed. |
| Portal admin Teach | Learner list, grants, workbook replies. **No delete.** |
| Learner Me / Settings | **Sign out** only. `delete-account` was listed in view-as `NEVER_ACTIONS` and had no handler. |
| `users.removed` | Checkbox. Used to end a view-as session (`target-removed`). **Not** checked on sign-in. |
| Payload REST `DELETE /api/users/:id` | Master only. Foreign keys are `ON DELETE set null`, so answers and progress would orphan. |
| Seed `--reset` | Drops the Postgres schema. Dev only. Not a product wipe. |

Database foreign keys to `users` and `portals` are almost all **`ON DELETE set null`**. Join tables cascade only when their **parent document** is deleted, not when the person or portal they point at is deleted.

## Auth, sessions and tokens

| Store | Table / field | Notes |
|---|---|---|
| Payload login | `users` (`email`, `hash`, `salt`, reset token fields) | Auth collection. |
| Login sessions | `users_sessions` (`_parent_id` → user, **cascade** when the user row goes) | Cookie is `{cookiePrefix}-token`, HttpOnly, 2 hours. |
| View as | `view-as-sessions` (`actor`, `target`, `portal`, `token`) | Append-only. Delete access is `nobody`. |
| Join / invite | `access-codes` (tenant `portal`) | Codes, not people. `users.access_code_id` points here. |
| Gather door | `gatherings.entry_code`, `checkin_token`; RSVP `guest_token`, `bring_code`, `ticket` on nights | Strings on the row. |
| JWT | No separate token collection | A wiped user and an empty session table make the old cookie dead. |

## Media and S3

Collection `media`. Local folder `media/` when the bucket is off. `@payloadcms/storage-s3` writes to the bucket when `S3_BUCKET` / Railway `BUCKET` is set. Columns: `filename`, `prefix`, `_objectkey`, `url`, `portal_id`.

Upload fields that point at `media`:

- `speakers.photo`
- `lessons.film`
- `resources.file`
- `answers.image`, `answers.audio`, `answers.video`
- `workbook-entries.image`
- `feedback-notes.audio`
- `opening-scenes.scene`
- `gather-photos.image`

Deleting a `media` row **set-nulls** those FKs. The object in S3 (or on disk) is **not** removed by app code. Shared library films and speaker photos must stay when a portal is wiped.

## Multi-tenant plugin

`@payloadcms/plugin-multi-tenant` adds `portal` to the slugs in `src/lib/tenant-collections.ts`. Master users see every tenant. Membership is `users_tenants` (`tenant_id` → portals, **set null** on portal delete; parent user **cascade**).

The product treats one account as one portal (`portalIdOf` uses `tenants[0]`; join refuses an email that already exists). The schema still allows several tenants, so a wipe must distinguish **take them off this portal** from **wipe the account**.

## Collection inventory

Legend: **MT** = plugin `portal`. **User cols** = relationship fields to `users`. **Wipe today** = what happens if you delete the portal or user row with no sweeper.

### Tenant root and accounts

| Slug | Table | Portal | Users | Uploads / JSON | Wipe today |
|---|---|---|---|---|---|
| `portals` | `portals` | self | — | `features` JSON (switches, no ids) | Soft `closed` only. |
| `users` | `users`, `users_tenants`, `users_sessions`, `users_rels` | `tenants[].tenant` | `updatedBy`, `onBehalfOf` | `courseList` JSON | No product delete. REST delete orphans children. |
| `media` | `media` | `portal` | — | the file itself | Master REST only. S3 object stays. |

### Shared library (must survive a portal wipe)

| Slug | Table | Portal / user | Uploads | Notes |
|---|---|---|---|---|
| `clauses`, `doors`, `seats`, `shelf-items` | matching snake | — | — | Global canon. |
| `speakers` | `speakers` | — | `photo` → media | Shared. Unlink only if a photo was portal-owned. |
| `courses` | `courses` | optional `portal`; `origin` master / local | — | Local courses belong to a portal. Master library stays; unlink `portal` and delete `adoptions`. |
| `units` | `units` | via course | — | Delete with a local course. Keep with a library course. |
| `lessons` | `lessons` | optional `portal` | `film` | Same split as courses. |
| `resources` | `resources` | via lesson | `file` | Same. |
| `packs` | `packs`, `packs_rels` | optional `portal` | — | Portal packs delete. Library packs unlink. |
| `cuts`, `ladder-items`, `talk-tiers`, `engagement-points` | matching | `talk-tiers.checkedBy`; points `author`, `reviewedBy`, `audienceUsers` | JSON timings / nudges | Library graph. Unlink staff ids. Delete only when the talk is local. |
| `tags` | `tags`, `tags_rels` | — | — | On talks. Delete with a local talk. |
| `sheet-keys` | `sheet_keys` | via lesson | — | Same. |
| `ai-steps`, `ai-desk` | matching | — | — | Global. Keep. |
| `ai-step-versions` | `ai_step_versions` | `author` | — | Unlink author. |
| `ai-step-jobs` | `ai_step_jobs` | `actor` | `lessonIds` JSON | Unlink actor. |
| `ai-step-outputs` | `ai_step_outputs` | — | JSON | Keep (tied to talks, not people). |
| `scripture-cache` | `scripture_cache` | — | `data` JSON | Global cache. |
| `heart-scales`, `lanes`, `opening-scenes`, `persona-bands`, `compass-settings` | matching | — | opening `scene` | Master wording. Keep. |
| `question-rewrites` | `question_rewrites` | `author` | — | Unlink author. Drafts on shared questions. |

### Tenant-scoped learner and desk data (hard delete)

| Slug | Table | User fields | Uploads / extras |
|---|---|---|---|
| `answers` | `answers` | `user` | image, audio, video |
| `workbook-entries` | `workbook_entries` | `user` | image; `teacherReply` text |
| `notifications` | `notifications` | `user` | — |
| `completions` | `completions` | `user` | garden / grow |
| `harvest-entries` | `harvest_entries` | `user` | garden harvest |
| `drawn-to` | `drawn_to` | `user` | short-clip analytics |
| `watch-sessions` | `watch_sessions` | `user` | — |
| `lesson-visits` | `lesson_visits` | `user` | — |
| `seat-visits` | `seat_visits` | `user` | — |
| `rituals` | `rituals` | `user` | — |
| `placing-answers` | `placing_answers` | `user` | — |
| `feedback-notes` | `feedback_notes` | `author` | audio |
| `schedules` | `schedules`, `schedules_rels` | `owner`, `learners` | `slots` JSON holds `lessonId` |
| `events` | `events` | — | nights |
| `rsvps` | `rsvps` | `user` | `ticket` |
| `checkins` | `checkins` | `user`, `byStaff` | nights |
| `messages` | `messages` | `author` | circle board |
| `access-codes` | `access_codes`, `access_codes_rels` | — | join codes |
| `adoptions` | `adoptions` | — | library link only |
| `gatherings` | `gatherings` | `host`, `proposedBy` | tokens, prompts JSON |
| `gather-rsvps` | `gather_rsvps` | `user`, `broughtBy` | guest token |
| `gather-checkins` | `gather_checkins` | `user` | — |
| `gather-reflections` | `gather_reflections` | `user` | — |
| `gather-photos` | `gather_photos` | `postedBy` | image |
| `opening-answers` | `opening_answers`, `opening_answers_rels` | `user`, `mentors` | delete access is `nobody` |
| `heart-states` | `heart_states` | `user` | JSON state |
| `heart-contributions` | `heart_contributions` | — | portal aggregates |
| `opening-configs` | `opening_configs`, rels | — | per-portal wording |
| `compass-attempts` | `compass_attempts` | `user` | JSON scales; Compass check-ins |
| `compass-mixes` | `compass_mixes` | — | one row per portal |
| `compass-serves` | `compass_serves` | `user` | — |
| `view-as-sessions` | `view_as_sessions` | `actor`, `target` | append-only |
| `audit-log` | `audit_log` | `actor`, `target` | `detail` JSON |
| `feedback-summaries` | `feedback_summaries` | `author` | — |
| `sheet-imports` | `sheet_imports` | `actor` | snapshot JSON |
| `placing-questions` | `placing_questions` | — | optional `portal` |
| `circle-answers` | `circle_answers` | `author`; optional `portal` | Swarm / circle. **Delete the words. Do not keep them anonymised.** Empty portal means every portal: delete only the author’s rows on a user wipe, or the portal-scoped rows on a portal wipe. |

### Join tables and array tables

| Table | Parent | Points at | On parent delete | On user / portal delete today |
|---|---|---|---|---|
| `users_tenants` | `users` | `portals` | cascade | tenant **set null** |
| `users_sessions` | `users` | — | cascade | gone with the user row |
| `users_rels` | `users` | packs, courses | cascade | — |
| `schedules_rels` | `schedules` | learners | cascade | leftover if only the user goes |
| `engagement_points_rels` | points | audience users | cascade | leftover audience id |
| `opening_answers_rels` | opening answers | mentors | cascade | leftover mentor id |
| `access_codes_rels` | codes | packs, courses | cascade | — |
| `packs_rels` | packs | courses | cascade | — |
| `opening_configs_rels` | configs | hidden scenes | cascade | — |
| `lanes_rels`, `lanes_clauses` | lanes | seats, clauses | cascade | not tenant-scoped |
| `tags_rels` | tags | lessons / cuts / points / courses | cascade | — |
| `payload_locked_documents_rels` | Payload locks | many | cascade | admin concern |
| `payload_kv`, `payload_preferences`, `payload_migrations` | Payload | — | — | do not wipe as product data |

## Feature settings

Not a collection. `portals.features` JSON (`20261004_230000_portal_features`). Turning a feature off may delete **adoptions** only (`src/server/features.ts`).

## Globals

`master-flags`: no delete. Leave it.

## Payload internals

`payload-kv`, `payload-locked-documents`, `payload-preferences`, `payload-migrations`. Not product data. The orphan script may mention lock rows that point at missing docs.

## Unmerged PRs (plug-in points)

These will add tables. The wipe registry test must fail until they register:

| PR | Likely new relations |
|---|---|
| #20 live | live sessions / presence |
| #22 experiments | experiment rows, assignments |
| #25 | (follow that PR’s collections) |
| #26 courses / My week | planner / week tables |
| #27 insights / missions | insight and mission rows |

Add the slug to `TENANT_COLLECTIONS` if it is tenant-scoped, and call `registerWipe(...)` in `src/server/erase/registry.ts`.

## What a correct wipe must do

1. One service, one database transaction.
2. Hard-delete tenant-scoped rows and a person’s own rows (including circle / swarm answers).
3. Unlink shared library talks, packs and staff-id fields.
4. Delete local courses and their subtree.
5. Delete the user row (sessions cascade) or, if they still belong to another portal, remove only this membership and this portal’s rows.
6. Never delete the last master admin.
7. After commit, delete S3 / disk objects; keep a retry list if that fails.
8. A read-only `db:orphans` report must then be clean. The script only SELECTs. Tables that are not in the database (later PRs such as #20, #22, #25, #26, #27, or a live schema that is behind) are skipped. It does not create `erase_s3_retries` or any other table. Safe to run on today’s live schema.

## Sources

`src/collections*.ts`, `src/payload.config.ts`, `src/payload-types.ts`, `src/migrations/*`, `src/server/handle.ts`, `src/server/viewas.ts`, `src/screens/desk/master.tsx`, `src/screens/desk/people.tsx`, `src/screens/app/me.tsx`.
