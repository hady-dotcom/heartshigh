import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "owner_id" integer;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "purpose" varchar;

  UPDATE "media" SET "purpose" = 'answer'
  WHERE "purpose" IS NULL AND "id" IN (
    SELECT "image_id" FROM "answers" WHERE "image_id" IS NOT NULL
    UNION SELECT "audio_id" FROM "answers" WHERE "audio_id" IS NOT NULL
    UNION SELECT "video_id" FROM "answers" WHERE "video_id" IS NOT NULL
    UNION SELECT "image_id" FROM "workbook_entries" WHERE "image_id" IS NOT NULL
  );

  UPDATE "media" SET "purpose" = 'feedback'
  WHERE "purpose" IS NULL AND "id" IN (
    SELECT "audio_id" FROM "feedback_notes" WHERE "audio_id" IS NOT NULL
  );

  UPDATE "media" SET "purpose" = 'film'
  WHERE "purpose" IS NULL AND "id" IN (
    SELECT "film_id" FROM "lessons" WHERE "film_id" IS NOT NULL
  );

  UPDATE "media" SET "purpose" = 'portal-asset' WHERE "purpose" IS NULL;

  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."image_id" = "media"."id";
  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."audio_id" = "media"."id";
  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."video_id" = "media"."id";
  UPDATE "media" SET "owner_id" = w."user_id"
  FROM "workbook_entries" w
  WHERE "media"."owner_id" IS NULL AND w."image_id" = "media"."id";
  UPDATE "media" SET "owner_id" = n."author_id"
  FROM "feedback_notes" n
  WHERE "media"."owner_id" IS NULL AND n."audio_id" = "media"."id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "purpose";
  `)
}
