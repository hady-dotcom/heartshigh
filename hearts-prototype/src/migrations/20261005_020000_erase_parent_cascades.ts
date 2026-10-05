import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Parent rows (a night, a gathering) own their tickets and replies.
 * SET NULL on those FKs cannot work: the child columns are NOT NULL.
 * Cascade matches the Payload schema names.
 */
const CASCADE: { table: string; column: string; ref: string; name: string }[] = [
  { table: 'rsvps', column: 'event_id', ref: 'events', name: 'rsvps_event_id_events_id_fk' },
  { table: 'checkins', column: 'event_id', ref: 'events', name: 'checkins_event_id_events_id_fk' },
  { table: 'gather_rsvps', column: 'gathering_id', ref: 'gatherings', name: 'gather_rsvps_gathering_id_gatherings_id_fk' },
  { table: 'gather_checkins', column: 'gathering_id', ref: 'gatherings', name: 'gather_checkins_gathering_id_gatherings_id_fk' },
  { table: 'gather_checkins', column: 'rsvp_id', ref: 'gather_rsvps', name: 'gather_checkins_rsvp_id_gather_rsvps_id_fk' },
  { table: 'gather_reflections', column: 'gathering_id', ref: 'gatherings', name: 'gather_reflections_gathering_id_gatherings_id_fk' },
  { table: 'gather_photos', column: 'gathering_id', ref: 'gatherings', name: 'gather_photos_gathering_id_gatherings_id_fk' },
]

function recreate(table: string, column: string, ref: string, name: string, onDelete: 'cascade' | 'set null') {
  return `
    ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}";
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "public"."${ref}"("id") ON DELETE ${onDelete} ON UPDATE no action;
  `
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const row of CASCADE) {
    await db.execute(sql.raw(recreate(row.table, row.column, row.ref, row.name, 'cascade')))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const row of CASCADE) {
    await db.execute(sql.raw(recreate(row.table, row.column, row.ref, row.name, 'set null')))
  }
}
