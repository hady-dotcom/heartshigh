import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "learner_welcome_id" integer;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "learner_intro_id" integer;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "teacher_welcome_id" integer;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "teacher_intro_id" integer;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "portals" ADD CONSTRAINT "portals_learner_welcome_id_media_id_fk" FOREIGN KEY ("learner_welcome_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "portals" ADD CONSTRAINT "portals_learner_intro_id_media_id_fk" FOREIGN KEY ("learner_intro_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "portals" ADD CONSTRAINT "portals_teacher_welcome_id_media_id_fk" FOREIGN KEY ("teacher_welcome_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "portals" ADD CONSTRAINT "portals_teacher_intro_id_media_id_fk" FOREIGN KEY ("teacher_intro_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP CONSTRAINT IF EXISTS "portals_learner_welcome_id_media_id_fk";
    ALTER TABLE "portals" DROP CONSTRAINT IF EXISTS "portals_learner_intro_id_media_id_fk";
    ALTER TABLE "portals" DROP CONSTRAINT IF EXISTS "portals_teacher_welcome_id_media_id_fk";
    ALTER TABLE "portals" DROP CONSTRAINT IF EXISTS "portals_teacher_intro_id_media_id_fk";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "learner_welcome_id";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "learner_intro_id";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "teacher_welcome_id";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "teacher_intro_id";
  `)
}
