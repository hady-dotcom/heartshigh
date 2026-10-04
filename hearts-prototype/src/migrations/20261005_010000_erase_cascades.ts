import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Safety net for a portal or user wipe. Tenant-scoped learner rows cascade when the
 * person or portal they belong to is deleted. Shared library FKs stay ON DELETE set null.
 * Column names match the Payload Postgres schema.
 */
const CASCADE: { table: string; column: string; ref: string; name: string }[] = [
  { table: 'answers', column: 'user_id', ref: 'users', name: 'answers_user_id_users_id_fk' },
  { table: 'answers', column: 'portal_id', ref: 'portals', name: 'answers_portal_id_portals_id_fk' },
  { table: 'workbook_entries', column: 'user_id', ref: 'users', name: 'workbook_entries_user_id_users_id_fk' },
  { table: 'workbook_entries', column: 'portal_id', ref: 'portals', name: 'workbook_entries_portal_id_portals_id_fk' },
  { table: 'notifications', column: 'user_id', ref: 'users', name: 'notifications_user_id_users_id_fk' },
  { table: 'notifications', column: 'portal_id', ref: 'portals', name: 'notifications_portal_id_portals_id_fk' },
  { table: 'completions', column: 'user_id', ref: 'users', name: 'completions_user_id_users_id_fk' },
  { table: 'completions', column: 'portal_id', ref: 'portals', name: 'completions_portal_id_portals_id_fk' },
  { table: 'harvest_entries', column: 'user_id', ref: 'users', name: 'harvest_entries_user_id_users_id_fk' },
  { table: 'harvest_entries', column: 'portal_id', ref: 'portals', name: 'harvest_entries_portal_id_portals_id_fk' },
  { table: 'drawn_to', column: 'user_id', ref: 'users', name: 'drawn_to_user_id_users_id_fk' },
  { table: 'drawn_to', column: 'portal_id', ref: 'portals', name: 'drawn_to_portal_id_portals_id_fk' },
  { table: 'watch_sessions', column: 'user_id', ref: 'users', name: 'watch_sessions_user_id_users_id_fk' },
  { table: 'watch_sessions', column: 'portal_id', ref: 'portals', name: 'watch_sessions_portal_id_portals_id_fk' },
  { table: 'lesson_visits', column: 'user_id', ref: 'users', name: 'lesson_visits_user_id_users_id_fk' },
  { table: 'lesson_visits', column: 'portal_id', ref: 'portals', name: 'lesson_visits_portal_id_portals_id_fk' },
  { table: 'seat_visits', column: 'user_id', ref: 'users', name: 'seat_visits_user_id_users_id_fk' },
  { table: 'seat_visits', column: 'portal_id', ref: 'portals', name: 'seat_visits_portal_id_portals_id_fk' },
  { table: 'rituals', column: 'user_id', ref: 'users', name: 'rituals_user_id_users_id_fk' },
  { table: 'rituals', column: 'portal_id', ref: 'portals', name: 'rituals_portal_id_portals_id_fk' },
  { table: 'placing_answers', column: 'user_id', ref: 'users', name: 'placing_answers_user_id_users_id_fk' },
  { table: 'placing_answers', column: 'portal_id', ref: 'portals', name: 'placing_answers_portal_id_portals_id_fk' },
  { table: 'feedback_notes', column: 'author_id', ref: 'users', name: 'feedback_notes_author_id_users_id_fk' },
  { table: 'feedback_notes', column: 'portal_id', ref: 'portals', name: 'feedback_notes_portal_id_portals_id_fk' },
  { table: 'schedules', column: 'portal_id', ref: 'portals', name: 'schedules_portal_id_portals_id_fk' },
  { table: 'events', column: 'portal_id', ref: 'portals', name: 'events_portal_id_portals_id_fk' },
  { table: 'rsvps', column: 'user_id', ref: 'users', name: 'rsvps_user_id_users_id_fk' },
  { table: 'rsvps', column: 'portal_id', ref: 'portals', name: 'rsvps_portal_id_portals_id_fk' },
  { table: 'checkins', column: 'user_id', ref: 'users', name: 'checkins_user_id_users_id_fk' },
  { table: 'checkins', column: 'portal_id', ref: 'portals', name: 'checkins_portal_id_portals_id_fk' },
  { table: 'messages', column: 'author_id', ref: 'users', name: 'messages_author_id_users_id_fk' },
  { table: 'messages', column: 'portal_id', ref: 'portals', name: 'messages_portal_id_portals_id_fk' },
  { table: 'access_codes', column: 'portal_id', ref: 'portals', name: 'access_codes_portal_id_portals_id_fk' },
  { table: 'adoptions', column: 'portal_id', ref: 'portals', name: 'adoptions_portal_id_portals_id_fk' },
  { table: 'gatherings', column: 'portal_id', ref: 'portals', name: 'gatherings_portal_id_portals_id_fk' },
  { table: 'gather_rsvps', column: 'user_id', ref: 'users', name: 'gather_rsvps_user_id_users_id_fk' },
  { table: 'gather_rsvps', column: 'portal_id', ref: 'portals', name: 'gather_rsvps_portal_id_portals_id_fk' },
  { table: 'gather_checkins', column: 'user_id', ref: 'users', name: 'gather_checkins_user_id_users_id_fk' },
  { table: 'gather_checkins', column: 'portal_id', ref: 'portals', name: 'gather_checkins_portal_id_portals_id_fk' },
  { table: 'gather_reflections', column: 'user_id', ref: 'users', name: 'gather_reflections_user_id_users_id_fk' },
  { table: 'gather_reflections', column: 'portal_id', ref: 'portals', name: 'gather_reflections_portal_id_portals_id_fk' },
  { table: 'gather_photos', column: 'portal_id', ref: 'portals', name: 'gather_photos_portal_id_portals_id_fk' },
  { table: 'opening_answers', column: 'user_id', ref: 'users', name: 'opening_answers_user_id_users_id_fk' },
  { table: 'opening_answers', column: 'portal_id', ref: 'portals', name: 'opening_answers_portal_id_portals_id_fk' },
  { table: 'heart_states', column: 'user_id', ref: 'users', name: 'heart_states_user_id_users_id_fk' },
  { table: 'heart_contributions', column: 'portal_id', ref: 'portals', name: 'heart_contributions_portal_id_portals_id_fk' },
  { table: 'opening_configs', column: 'portal_id', ref: 'portals', name: 'opening_configs_portal_id_portals_id_fk' },
  { table: 'compass_attempts', column: 'user_id', ref: 'users', name: 'compass_attempts_user_id_users_id_fk' },
  { table: 'compass_attempts', column: 'portal_id', ref: 'portals', name: 'compass_attempts_portal_id_portals_id_fk' },
  { table: 'compass_mixes', column: 'portal_id', ref: 'portals', name: 'compass_mixes_portal_id_portals_id_fk' },
  { table: 'compass_serves', column: 'user_id', ref: 'users', name: 'compass_serves_user_id_users_id_fk' },
  { table: 'compass_serves', column: 'portal_id', ref: 'portals', name: 'compass_serves_portal_id_portals_id_fk' },
  { table: 'view_as_sessions', column: 'actor_id', ref: 'users', name: 'view_as_sessions_actor_id_users_id_fk' },
  { table: 'view_as_sessions', column: 'target_id', ref: 'users', name: 'view_as_sessions_target_id_users_id_fk' },
  { table: 'view_as_sessions', column: 'portal_id', ref: 'portals', name: 'view_as_sessions_portal_id_portals_id_fk' },
  { table: 'audit_log', column: 'actor_id', ref: 'users', name: 'audit_log_actor_id_users_id_fk' },
  { table: 'audit_log', column: 'target_id', ref: 'users', name: 'audit_log_target_id_users_id_fk' },
  { table: 'audit_log', column: 'portal_id', ref: 'portals', name: 'audit_log_portal_id_portals_id_fk' },
  { table: 'circle_answers', column: 'author_id', ref: 'users', name: 'circle_answers_author_id_users_id_fk' },
  { table: 'circle_answers', column: 'portal_id', ref: 'portals', name: 'circle_answers_portal_id_portals_id_fk' },
  { table: 'feedback_summaries', column: 'portal_id', ref: 'portals', name: 'feedback_summaries_portal_id_portals_id_fk' },
  { table: 'users_tenants', column: 'tenant_id', ref: 'portals', name: 'users_tenants_tenant_id_portals_id_fk' },
]

function recreate(table: string, column: string, ref: string, name: string, onDelete: 'cascade' | 'set null') {
  return `
    ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}";
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "public"."${ref}"("id") ON DELETE ${onDelete} ON UPDATE no action;
  `
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "erase_s3_retries" (
      "id" serial PRIMARY KEY NOT NULL,
      "object_key" varchar NOT NULL,
      "bucket" varchar,
      "filename" varchar,
      "local_path" varchar,
      "error" varchar,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "attempts" integer DEFAULT 0
    );
  `)
  for (const row of CASCADE) {
    await db.execute(sql.raw(recreate(row.table, row.column, row.ref, row.name, 'cascade')))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const row of CASCADE) {
    await db.execute(sql.raw(recreate(row.table, row.column, row.ref, row.name, 'set null')))
  }
  await db.execute(sql`DROP TABLE IF EXISTS "erase_s3_retries";`)
}
