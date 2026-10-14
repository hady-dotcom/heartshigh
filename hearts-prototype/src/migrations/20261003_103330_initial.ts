import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // A database that was created by push already has this schema and no migration history.
  // Recording the migration without repeating the CREATE statements lets it move onto later migrations.
  const existing = await db.execute(sql`select to_regclass('public.users') as users`)
  const already = (existing.rows[0] as { users?: string | null } | undefined)?.users
  if (already) {
    console.log('The users table is already there, so this migration is recorded without running the create statements again.')
    return
  }
  await db.execute(sql`
   CREATE TYPE "public"."enum_portals_kind" AS ENUM('mosque', 'church', 'synagogue', 'other');
  CREATE TYPE "public"."enum_portals_theme" AS ENUM('light', 'dark');
  CREATE TYPE "public"."enum_users_role" AS ENUM('master', 'portal-admin', 'teacher', 'learner');
  CREATE TYPE "public"."enum_courses_origin" AS ENUM('master', 'local');
  CREATE TYPE "public"."enum_courses_visibility" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_lessons_transcript_source" AS ENUM('none', 'youtube', 'upload', 'pending');
  CREATE TYPE "public"."enum_resources_kind" AS ENUM('link', 'file');
  CREATE TYPE "public"."enum_packs_owner" AS ENUM('master', 'portal');
  CREATE TYPE "public"."enum_cuts_status" AS ENUM('draft', 'suggested', 'approved', 'rejected');
  CREATE TYPE "public"."enum_cuts_presentation" AS ENUM('video', 'slide');
  CREATE TYPE "public"."enum_ladder_items_kind" AS ENUM('hors', 'appetiser');
  CREATE TYPE "public"."enum_ladder_items_status" AS ENUM('draft', 'approved', 'rejected');
  CREATE TYPE "public"."enum_engagement_points_trigger_type" AS ENUM('timestamp');
  CREATE TYPE "public"."enum_engagement_points_kind" AS ENUM('question', 'multiple_choice', 'reflection', 'task');
  CREATE TYPE "public"."enum_engagement_points_timing" AS ENUM('immediate', 'future');
  CREATE TYPE "public"."enum_engagement_points_delay_unit" AS ENUM('second', 'minute', 'hour', 'day', 'week');
  CREATE TYPE "public"."enum_engagement_points_audience" AS ENUM('everyone', 'self', 'selected');
  CREATE TYPE "public"."enum_engagement_points_status" AS ENUM('published', 'draft', 'rejected');
  CREATE TYPE "public"."enum_access_codes_role" AS ENUM('learner', 'teacher', 'admin', 'parent');
  CREATE TYPE "public"."enum_talk_tiers_status" AS ENUM('draft', 'checked', 'rejected');
  CREATE TYPE "public"."enum_adoptions_kind" AS ENUM('pack', 'course');
  CREATE TYPE "public"."enum_tags_state" AS ENUM('suggested', 'confirmed');
  CREATE TYPE "public"."enum_harvest_entries_kind" AS ENUM('quran', 'hadith');
  CREATE TYPE "public"."enum_schedules_target_type" AS ENUM('course', 'pack');
  CREATE TYPE "public"."enum_rsvps_ticket_kind" AS ENUM('earned', 'held');
  CREATE TYPE "public"."enum_heart_scales_key" AS ENUM('desire', 'greed', 'anger', 'ego', 'worry', 'belonging', 'gratitude', 'faith', 'compassion', 'discipline');
  CREATE TYPE "public"."enum_heart_scales_room" AS ENUM('appetites', 'heat', 'unsettled', 'lights');
  CREATE TYPE "public"."enum_heart_scales_season" AS ENUM('youth', 'health', 'wealth', 'freeTime', 'life');
  CREATE TYPE "public"."enum_lanes_starters_role" AS ENUM('first', 'next', 'mains');
  CREATE TYPE "public"."enum_lanes_fit" AS ENUM('natural', 'workable', 'weak');
  CREATE TYPE "public"."enum_opening_scenes_options_nudges_scale" AS ENUM('desire', 'greed', 'anger', 'ego', 'worry', 'belonging', 'gratitude', 'faith', 'compassion', 'discipline');
  CREATE TYPE "public"."enum_opening_scenes_options_sensitivity" AS ENUM('normal', 'private');
  CREATE TYPE "public"."enum_opening_scenes_layout" AS ENUM('grid4', 'bubbles', 'doorsCarousel');
  CREATE TYPE "public"."enum_opening_scenes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_view_as_sessions_end_reason" AS ENUM('exit', 'idle-timeout', 'max-timeout', 'replaced', 'actor-signed-out', 'role-changed', 'target-removed', 'portal-closed');
  CREATE TABLE "portals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_portals_kind" DEFAULT 'mosque',
  	"welcome" varchar,
  	"colour" varchar DEFAULT '#1f4d3a',
  	"watch_history_opt_in" boolean DEFAULT false,
  	"organisation_name" varchar,
  	"description" varchar,
  	"closed" boolean DEFAULT false,
  	"logo_url" varchar,
  	"show_others_answers" boolean DEFAULT true,
  	"notification_emails" varchar,
  	"theme" "enum_portals_theme" DEFAULT 'light',
  	"calendar_url" varchar,
  	"learner_welcome_url" varchar,
  	"learner_intro_url" varchar,
  	"teacher_welcome_url" varchar,
  	"teacher_intro_url" varchar,
  	"learner_label" varchar DEFAULT 'Learner',
  	"teacher_label" varchar DEFAULT 'Teacher',
  	"wizard_done" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'learner' NOT NULL,
  	"access_code_id" integer,
  	"onboarded" boolean DEFAULT false,
  	"seen_welcome" boolean DEFAULT false,
  	"starting_clause" numeric,
  	"course_list" jsonb,
  	"audience" varchar,
  	"share_watch" boolean DEFAULT false,
  	"joined_at" timestamp(3) with time zone,
  	"night_alerts" boolean DEFAULT false,
  	"share_opening" boolean DEFAULT false,
  	"keep_place" boolean DEFAULT false,
  	"trends_opt_in" boolean DEFAULT false,
  	"share_with_learners" boolean DEFAULT false,
  	"haptics" boolean DEFAULT true,
  	"removed" boolean DEFAULT false,
  	"updated_by_id" integer,
  	"on_behalf_of_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"packs_id" integer,
  	"courses_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"portal_id" integer,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "clauses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric NOT NULL,
  	"fragment" varchar NOT NULL,
  	"core" varchar,
  	"teaching" varchar,
  	"series" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clause_id" integer NOT NULL,
  	"position" numeric NOT NULL,
  	"text" varchar NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shelf_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"volume" varchar,
  	"section" varchar,
  	"title" varchar NOT NULL,
  	"series" varchar,
  	"empty" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"speaker" varchar,
  	"origin" "enum_courses_origin" DEFAULT 'master' NOT NULL,
  	"portal_id" integer,
  	"importable" boolean DEFAULT true,
  	"is_public" boolean DEFAULT false,
  	"import_token" varchar,
  	"hidden" boolean DEFAULT false,
  	"visibility" "enum_courses_visibility" DEFAULT 'published',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"course_id" integer NOT NULL,
  	"order" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"unit_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"portal_id" integer,
  	"master" boolean DEFAULT false,
  	"order" numeric DEFAULT 1,
  	"speaker" varchar,
  	"youtube_url" varchar,
  	"youtube_id" varchar,
  	"mux_asset_id" varchar,
  	"mux_playback_id" varchar,
  	"duration_seconds" numeric,
  	"transcript" varchar,
  	"transcript_source" "enum_lessons_transcript_source" DEFAULT 'none',
  	"transcript_note" varchar,
  	"source_url" varchar,
  	"csv_seq" numeric,
  	"starter_lane" varchar,
  	"source_title" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_resources_kind" DEFAULT 'link',
  	"url" varchar,
  	"show_at_end" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "packs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"owner" "enum_packs_owner" DEFAULT 'master' NOT NULL,
  	"portal_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "packs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer
  );
  
  CREATE TABLE "cuts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"course_id" integer,
  	"status" "enum_cuts_status" DEFAULT 'draft',
  	"placeholder" boolean DEFAULT false,
  	"presentation" "enum_cuts_presentation" DEFAULT 'video',
  	"playable" boolean DEFAULT true,
  	"last_error" varchar,
  	"start" numeric NOT NULL,
  	"end" numeric NOT NULL,
  	"timestamp" varchar,
  	"hook" varchar NOT NULL,
  	"turn" varchar NOT NULL,
  	"land" varchar NOT NULL,
  	"full_context" varchar,
  	"theme" varchar,
  	"device" varchar,
  	"why_it_allures" varchar,
  	"best_clause" numeric,
  	"clause_fragment" varchar,
  	"hang_strength" varchar,
  	"why_hang" varchar,
  	"seat_hint" varchar,
  	"stage2_form" varchar,
  	"currency_note" varchar,
  	"quote_confidence" varchar,
  	"exemplar_affinity" varchar,
  	"kind" varchar,
  	"engine" varchar,
  	"seat_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ladder_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"cut_id" integer,
  	"kind" "enum_ladder_items_kind",
  	"start" numeric,
  	"end" numeric,
  	"quote" varchar,
  	"status" "enum_ladder_items_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "engagement_points" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"cut_id" integer,
  	"trigger_type" "enum_engagement_points_trigger_type" DEFAULT 'timestamp',
  	"second" numeric DEFAULT 0 NOT NULL,
  	"nudges" jsonb,
  	"crisis_option" varchar,
  	"correct_option" varchar,
  	"time_limit_sec" numeric,
  	"kind" "enum_engagement_points_kind" DEFAULT 'reflection',
  	"prompt" varchar NOT NULL,
  	"options" jsonb,
  	"timing" "enum_engagement_points_timing" DEFAULT 'immediate',
  	"delay_amount" numeric DEFAULT 0,
  	"delay_unit" "enum_engagement_points_delay_unit" DEFAULT 'week',
  	"contingent_id" integer,
  	"link" varchar,
  	"time_limit" numeric,
  	"author_id" integer,
  	"audience" "enum_engagement_points_audience" DEFAULT 'everyone',
  	"status" "enum_engagement_points_status" DEFAULT 'published',
  	"draft_note" varchar,
  	"reviewed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "engagement_points_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "answers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"point_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer,
  	"body" varchar,
  	"choice" varchar,
  	"image_id" integer,
  	"audio_id" integer,
  	"video_id" integer,
  	"keep_private" boolean DEFAULT false,
  	"share_with_teacher" boolean DEFAULT false,
  	"share_with_learners" boolean DEFAULT false,
  	"cut_id" integer,
  	"at_second" numeric,
  	"viewing_id" varchar,
  	"answered_at" timestamp(3) with time zone,
  	"pending_sync" boolean DEFAULT false,
  	"correct" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "workbook_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"answer_id" integer,
  	"lesson_id" integer,
  	"course_id" integer,
  	"body" varchar,
  	"image_id" integer,
  	"consent" boolean DEFAULT false,
  	"teacher_reply" varchar,
  	"replied_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"href" varchar,
  	"read" boolean DEFAULT false,
  	"channel" varchar DEFAULT 'in-app',
  	"key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "access_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"code" varchar NOT NULL,
  	"role" "enum_access_codes_role" NOT NULL,
  	"linked_teacher_code_id" integer,
  	"parent_mentor_code_id" integer,
  	"label" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"max_uses" numeric,
  	"uses" numeric DEFAULT 0,
  	"disabled" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "access_codes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"packs_id" integer,
  	"courses_id" integer
  );
  
  CREATE TABLE "talk_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"hors_start" numeric NOT NULL,
  	"hors_end" numeric NOT NULL,
  	"hors_quote" varchar,
  	"appetiser_start" numeric NOT NULL,
  	"appetiser_end" numeric NOT NULL,
  	"hook" varchar,
  	"turn" varchar,
  	"land" varchar,
  	"hook_at" numeric,
  	"turn_at" numeric,
  	"land_at" numeric,
  	"hors_lines" jsonb,
  	"offer_resume" boolean DEFAULT true,
  	"status" "enum_talk_tiers_status" DEFAULT 'draft',
  	"checked_at" timestamp(3) with time zone,
  	"source" varchar,
  	"note" varchar,
  	"checked_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "adoptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"kind" "enum_adoptions_kind" NOT NULL,
  	"pack_id" integer,
  	"course_id" integer,
  	"hidden" boolean DEFAULT false,
  	"order" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "placing_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prompt" varchar NOT NULL,
  	"why" varchar,
  	"options" jsonb NOT NULL,
  	"order" numeric DEFAULT 1,
  	"portal_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "placing_answers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"question_id" integer NOT NULL,
  	"choice" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"clause_id" integer,
  	"seat_id" integer,
  	"lane_id" integer,
  	"weight" numeric DEFAULT 1,
  	"state" "enum_tags_state" DEFAULT 'suggested',
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"lessons_id" integer,
  	"cuts_id" integer,
  	"engagement_points_id" integer,
  	"courses_id" integer
  );
  
  CREATE TABLE "harvest_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer,
  	"kind" "enum_harvest_entries_kind",
  	"text" varchar,
  	"reference" varchar,
  	"timestamp" varchar,
  	"context" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "schedules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"name" varchar NOT NULL,
  	"owner_id" integer,
  	"target_type" "enum_schedules_target_type",
  	"course_id" integer,
  	"pack_id" integer,
  	"start_date" varchar NOT NULL,
  	"end_date" varchar NOT NULL,
  	"weekdays" jsonb NOT NULL,
  	"slots" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "schedules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"title" varchar NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"place" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rsvps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"event_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"status" varchar DEFAULT 'going',
  	"ticket" varchar,
  	"ticket_kind" "enum_rsvps_ticket_kind" DEFAULT 'held',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "checkins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"event_id" integer NOT NULL,
  	"user_id" integer NOT NULL,
  	"override" boolean DEFAULT false,
  	"by_staff_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"author_id" integer,
  	"body" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "completions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"percent" numeric DEFAULT 100,
  	"on_time" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "feedback_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"answer_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"second" numeric DEFAULT 0 NOT NULL,
  	"body" varchar NOT NULL,
  	"audio_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "watch_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"seconds" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lesson_visits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seat_visits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"seat_id" integer NOT NULL,
  	"returned" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rituals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"note" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "heart_scales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" "enum_heart_scales_key" NOT NULL,
  	"leon_name" varchar NOT NULL,
  	"room" "enum_heart_scales_room",
  	"polish_label" varchar,
  	"season" "enum_heart_scales_season",
  	"first_open_read" boolean DEFAULT true,
  	"anchors" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lanes_clauses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"clause_id" integer NOT NULL,
  	"rank" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "lanes_starters" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"role" "enum_lanes_starters_role" NOT NULL,
  	"order" numeric DEFAULT 1
  );
  
  CREATE TABLE "lanes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"scale_id" integer,
  	"fit" "enum_lanes_fit",
  	"series_note" varchar,
  	"opt_in_only" boolean DEFAULT false,
  	"order" numeric DEFAULT 1,
  	"reach_phrase" varchar,
  	"pseudo" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lanes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"seats_id" integer,
  	"clauses_id" integer
  );
  
  CREATE TABLE "opening_scenes_options_nudges" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"scale" "enum_opening_scenes_options_nudges_scale" NOT NULL,
  	"delta" numeric DEFAULT 0
  );
  
  CREATE TABLE "opening_scenes_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"reply_pill" varchar,
  	"intent_lane_id" integer,
  	"spine_first" boolean DEFAULT false,
  	"crisis" boolean DEFAULT false,
  	"sensitivity" "enum_opening_scenes_options_sensitivity" DEFAULT 'normal'
  );
  
  CREATE TABLE "opening_scenes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"order" numeric DEFAULT 1,
  	"caption" varchar NOT NULL,
  	"subline" varchar,
  	"scene_id" integer,
  	"layout" "enum_opening_scenes_layout" DEFAULT 'grid4',
  	"status" "enum_opening_scenes_status" DEFAULT 'draft',
  	"version" numeric DEFAULT 1,
  	"adapted_from" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_configs_wording" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"scene_id" integer NOT NULL,
  	"caption" varchar,
  	"subline" varchar,
  	"labels" jsonb
  );
  
  CREATE TABLE "opening_configs_help_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"phone" varchar,
  	"url" varchar,
  	"hours" varchar
  );
  
  CREATE TABLE "opening_configs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"default_clip_id" integer,
  	"trends_contribution_prompt" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_configs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"opening_scenes_id" integer
  );
  
  CREATE TABLE "heart_states" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"state" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_answers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"portal_id" integer,
  	"scene_id" integer,
  	"scene_key" varchar NOT NULL,
  	"option_key" varchar NOT NULL,
  	"label_snapshot" varchar,
  	"private" boolean DEFAULT false,
  	"staff_visible" boolean DEFAULT false,
  	"scenes_version" numeric,
  	"answered_at" timestamp(3) with time zone,
  	"recorded_at" timestamp(3) with time zone,
  	"superseded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_answers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "heart_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer NOT NULL,
  	"iso_week" varchar NOT NULL,
  	"door_key" varchar,
  	"scene_passes" jsonb,
  	"lane_top2" jsonb,
  	"nonce_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "view_as_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"actor_id" integer NOT NULL,
  	"actor_role" varchar,
  	"target_id" integer NOT NULL,
  	"target_role" varchar,
  	"portal_id" integer,
  	"reason" varchar NOT NULL,
  	"token" varchar,
  	"started_at" timestamp(3) with time zone,
  	"last_seen_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"ended_at" timestamp(3) with time zone,
  	"end_reason" "enum_view_as_sessions_end_reason",
  	"write_enabled" boolean DEFAULT false,
  	"write_until" timestamp(3) with time zone,
  	"return_to" varchar,
  	"ip_hash" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event" varchar NOT NULL,
  	"actor_id" integer,
  	"actor_role" varchar,
  	"target_id" integer,
  	"target_role" varchar,
  	"portal_id" integer,
  	"session_id" varchar,
  	"reason" varchar,
  	"at" timestamp(3) with time zone NOT NULL,
  	"ip_hash" varchar,
  	"detail" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"portals_id" integer,
  	"users_id" integer,
  	"media_id" integer,
  	"clauses_id" integer,
  	"seats_id" integer,
  	"shelf_items_id" integer,
  	"courses_id" integer,
  	"units_id" integer,
  	"lessons_id" integer,
  	"resources_id" integer,
  	"packs_id" integer,
  	"cuts_id" integer,
  	"ladder_items_id" integer,
  	"engagement_points_id" integer,
  	"answers_id" integer,
  	"workbook_entries_id" integer,
  	"notifications_id" integer,
  	"access_codes_id" integer,
  	"talk_tiers_id" integer,
  	"adoptions_id" integer,
  	"placing_questions_id" integer,
  	"placing_answers_id" integer,
  	"tags_id" integer,
  	"harvest_entries_id" integer,
  	"schedules_id" integer,
  	"events_id" integer,
  	"rsvps_id" integer,
  	"checkins_id" integer,
  	"messages_id" integer,
  	"completions_id" integer,
  	"feedback_notes_id" integer,
  	"watch_sessions_id" integer,
  	"lesson_visits_id" integer,
  	"seat_visits_id" integer,
  	"rituals_id" integer,
  	"heart_scales_id" integer,
  	"lanes_id" integer,
  	"opening_scenes_id" integer,
  	"opening_configs_id" integer,
  	"heart_states_id" integer,
  	"opening_answers_id" integer,
  	"heart_contributions_id" integer,
  	"view_as_sessions_id" integer,
  	"audit_log_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "master_flags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"popup_over_player" boolean DEFAULT true,
  	"chrome_over_player" boolean DEFAULT true,
  	"show_unchecked" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_portals_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_on_behalf_of_id_users_id_fk" FOREIGN KEY ("on_behalf_of_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_packs_fk" FOREIGN KEY ("packs_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seats" ADD CONSTRAINT "seats_clause_id_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "units" ADD CONSTRAINT "units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packs" ADD CONSTRAINT "packs_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "packs_rels" ADD CONSTRAINT "packs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "packs_rels" ADD CONSTRAINT "packs_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cuts" ADD CONSTRAINT "cuts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cuts" ADD CONSTRAINT "cuts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cuts" ADD CONSTRAINT "cuts_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ladder_items" ADD CONSTRAINT "ladder_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ladder_items" ADD CONSTRAINT "ladder_items_cut_id_cuts_id_fk" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points" ADD CONSTRAINT "engagement_points_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points" ADD CONSTRAINT "engagement_points_cut_id_cuts_id_fk" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points" ADD CONSTRAINT "engagement_points_contingent_id_engagement_points_id_fk" FOREIGN KEY ("contingent_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points" ADD CONSTRAINT "engagement_points_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points" ADD CONSTRAINT "engagement_points_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "engagement_points_rels" ADD CONSTRAINT "engagement_points_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."engagement_points"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "engagement_points_rels" ADD CONSTRAINT "engagement_points_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_point_id_engagement_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "answers" ADD CONSTRAINT "answers_cut_id_cuts_id_fk" FOREIGN KEY ("cut_id") REFERENCES "public"."cuts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workbook_entries" ADD CONSTRAINT "workbook_entries_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_linked_teacher_code_id_access_codes_id_fk" FOREIGN KEY ("linked_teacher_code_id") REFERENCES "public"."access_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_parent_mentor_code_id_access_codes_id_fk" FOREIGN KEY ("parent_mentor_code_id") REFERENCES "public"."access_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_codes_rels" ADD CONSTRAINT "access_codes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."access_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "access_codes_rels" ADD CONSTRAINT "access_codes_rels_packs_fk" FOREIGN KEY ("packs_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "access_codes_rels" ADD CONSTRAINT "access_codes_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "talk_tiers" ADD CONSTRAINT "talk_tiers_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "talk_tiers" ADD CONSTRAINT "talk_tiers_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adoptions" ADD CONSTRAINT "adoptions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "placing_questions" ADD CONSTRAINT "placing_questions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "placing_answers" ADD CONSTRAINT "placing_answers_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "placing_answers" ADD CONSTRAINT "placing_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "placing_answers" ADD CONSTRAINT "placing_answers_question_id_placing_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."placing_questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_clause_id_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_lane_id_lanes_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lanes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_cuts_fk" FOREIGN KEY ("cuts_id") REFERENCES "public"."cuts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_engagement_points_fk" FOREIGN KEY ("engagement_points_id") REFERENCES "public"."engagement_points"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "harvest_entries" ADD CONSTRAINT "harvest_entries_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "harvest_entries" ADD CONSTRAINT "harvest_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "harvest_entries" ADD CONSTRAINT "harvest_entries_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedules" ADD CONSTRAINT "schedules_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedules" ADD CONSTRAINT "schedules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedules" ADD CONSTRAINT "schedules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedules" ADD CONSTRAINT "schedules_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "schedules_rels" ADD CONSTRAINT "schedules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "schedules_rels" ADD CONSTRAINT "schedules_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_by_staff_id_users_id_fk" FOREIGN KEY ("by_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "completions" ADD CONSTRAINT "completions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "completions" ADD CONSTRAINT "completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "completions" ADD CONSTRAINT "completions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_audio_id_media_id_fk" FOREIGN KEY ("audio_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "watch_sessions" ADD CONSTRAINT "watch_sessions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "watch_sessions" ADD CONSTRAINT "watch_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "watch_sessions" ADD CONSTRAINT "watch_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lesson_visits" ADD CONSTRAINT "lesson_visits_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lesson_visits" ADD CONSTRAINT "lesson_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lesson_visits" ADD CONSTRAINT "lesson_visits_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seat_visits" ADD CONSTRAINT "seat_visits_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seat_visits" ADD CONSTRAINT "seat_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seat_visits" ADD CONSTRAINT "seat_visits_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rituals" ADD CONSTRAINT "rituals_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rituals" ADD CONSTRAINT "rituals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lanes_clauses" ADD CONSTRAINT "lanes_clauses_clause_id_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."clauses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lanes_clauses" ADD CONSTRAINT "lanes_clauses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lanes_starters" ADD CONSTRAINT "lanes_starters_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lanes_starters" ADD CONSTRAINT "lanes_starters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lanes" ADD CONSTRAINT "lanes_scale_id_heart_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."heart_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lanes_rels" ADD CONSTRAINT "lanes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lanes_rels" ADD CONSTRAINT "lanes_rels_seats_fk" FOREIGN KEY ("seats_id") REFERENCES "public"."seats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lanes_rels" ADD CONSTRAINT "lanes_rels_clauses_fk" FOREIGN KEY ("clauses_id") REFERENCES "public"."clauses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_scenes_options_nudges" ADD CONSTRAINT "opening_scenes_options_nudges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."opening_scenes_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_scenes_options" ADD CONSTRAINT "opening_scenes_options_intent_lane_id_lanes_id_fk" FOREIGN KEY ("intent_lane_id") REFERENCES "public"."lanes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_scenes_options" ADD CONSTRAINT "opening_scenes_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."opening_scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_scenes" ADD CONSTRAINT "opening_scenes_scene_id_media_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_configs_wording" ADD CONSTRAINT "opening_configs_wording_scene_id_opening_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."opening_scenes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_configs_wording" ADD CONSTRAINT "opening_configs_wording_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."opening_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_configs_help_contacts" ADD CONSTRAINT "opening_configs_help_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."opening_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_configs" ADD CONSTRAINT "opening_configs_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_configs" ADD CONSTRAINT "opening_configs_default_clip_id_cuts_id_fk" FOREIGN KEY ("default_clip_id") REFERENCES "public"."cuts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_configs_rels" ADD CONSTRAINT "opening_configs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."opening_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_configs_rels" ADD CONSTRAINT "opening_configs_rels_opening_scenes_fk" FOREIGN KEY ("opening_scenes_id") REFERENCES "public"."opening_scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "heart_states" ADD CONSTRAINT "heart_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_answers" ADD CONSTRAINT "opening_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_answers" ADD CONSTRAINT "opening_answers_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_answers" ADD CONSTRAINT "opening_answers_scene_id_opening_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."opening_scenes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_answers_rels" ADD CONSTRAINT "opening_answers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."opening_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opening_answers_rels" ADD CONSTRAINT "opening_answers_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "heart_contributions" ADD CONSTRAINT "heart_contributions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "view_as_sessions" ADD CONSTRAINT "view_as_sessions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "view_as_sessions" ADD CONSTRAINT "view_as_sessions_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "view_as_sessions" ADD CONSTRAINT "view_as_sessions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portals_fk" FOREIGN KEY ("portals_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clauses_fk" FOREIGN KEY ("clauses_id") REFERENCES "public"."clauses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seats_fk" FOREIGN KEY ("seats_id") REFERENCES "public"."seats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shelf_items_fk" FOREIGN KEY ("shelf_items_id") REFERENCES "public"."shelf_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_units_fk" FOREIGN KEY ("units_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_packs_fk" FOREIGN KEY ("packs_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cuts_fk" FOREIGN KEY ("cuts_id") REFERENCES "public"."cuts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ladder_items_fk" FOREIGN KEY ("ladder_items_id") REFERENCES "public"."ladder_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_engagement_points_fk" FOREIGN KEY ("engagement_points_id") REFERENCES "public"."engagement_points"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_answers_fk" FOREIGN KEY ("answers_id") REFERENCES "public"."answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workbook_entries_fk" FOREIGN KEY ("workbook_entries_id") REFERENCES "public"."workbook_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_access_codes_fk" FOREIGN KEY ("access_codes_id") REFERENCES "public"."access_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_talk_tiers_fk" FOREIGN KEY ("talk_tiers_id") REFERENCES "public"."talk_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_adoptions_fk" FOREIGN KEY ("adoptions_id") REFERENCES "public"."adoptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_placing_questions_fk" FOREIGN KEY ("placing_questions_id") REFERENCES "public"."placing_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_placing_answers_fk" FOREIGN KEY ("placing_answers_id") REFERENCES "public"."placing_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_harvest_entries_fk" FOREIGN KEY ("harvest_entries_id") REFERENCES "public"."harvest_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_schedules_fk" FOREIGN KEY ("schedules_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rsvps_fk" FOREIGN KEY ("rsvps_id") REFERENCES "public"."rsvps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_checkins_fk" FOREIGN KEY ("checkins_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_completions_fk" FOREIGN KEY ("completions_id") REFERENCES "public"."completions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feedback_notes_fk" FOREIGN KEY ("feedback_notes_id") REFERENCES "public"."feedback_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_watch_sessions_fk" FOREIGN KEY ("watch_sessions_id") REFERENCES "public"."watch_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lesson_visits_fk" FOREIGN KEY ("lesson_visits_id") REFERENCES "public"."lesson_visits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seat_visits_fk" FOREIGN KEY ("seat_visits_id") REFERENCES "public"."seat_visits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rituals_fk" FOREIGN KEY ("rituals_id") REFERENCES "public"."rituals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_heart_scales_fk" FOREIGN KEY ("heart_scales_id") REFERENCES "public"."heart_scales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lanes_fk" FOREIGN KEY ("lanes_id") REFERENCES "public"."lanes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_scenes_fk" FOREIGN KEY ("opening_scenes_id") REFERENCES "public"."opening_scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_configs_fk" FOREIGN KEY ("opening_configs_id") REFERENCES "public"."opening_configs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_heart_states_fk" FOREIGN KEY ("heart_states_id") REFERENCES "public"."heart_states"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_answers_fk" FOREIGN KEY ("opening_answers_id") REFERENCES "public"."opening_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_heart_contributions_fk" FOREIGN KEY ("heart_contributions_id") REFERENCES "public"."heart_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_view_as_sessions_fk" FOREIGN KEY ("view_as_sessions_id") REFERENCES "public"."view_as_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "portals_slug_idx" ON "portals" USING btree ("slug");
  CREATE INDEX "portals_updated_at_idx" ON "portals" USING btree ("updated_at");
  CREATE INDEX "portals_created_at_idx" ON "portals" USING btree ("created_at");
  CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_access_code_idx" ON "users" USING btree ("access_code_id");
  CREATE INDEX "users_updated_by_idx" ON "users" USING btree ("updated_by_id");
  CREATE INDEX "users_on_behalf_of_idx" ON "users" USING btree ("on_behalf_of_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_packs_id_idx" ON "users_rels" USING btree ("packs_id");
  CREATE INDEX "users_rels_courses_id_idx" ON "users_rels" USING btree ("courses_id");
  CREATE INDEX "media_portal_idx" ON "media" USING btree ("portal_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "clauses_number_idx" ON "clauses" USING btree ("number");
  CREATE INDEX "clauses_updated_at_idx" ON "clauses" USING btree ("updated_at");
  CREATE INDEX "clauses_created_at_idx" ON "clauses" USING btree ("created_at");
  CREATE INDEX "seats_clause_idx" ON "seats" USING btree ("clause_id");
  CREATE INDEX "seats_updated_at_idx" ON "seats" USING btree ("updated_at");
  CREATE INDEX "seats_created_at_idx" ON "seats" USING btree ("created_at");
  CREATE INDEX "shelf_items_updated_at_idx" ON "shelf_items" USING btree ("updated_at");
  CREATE INDEX "shelf_items_created_at_idx" ON "shelf_items" USING btree ("created_at");
  CREATE INDEX "courses_portal_idx" ON "courses" USING btree ("portal_id");
  CREATE INDEX "courses_import_token_idx" ON "courses" USING btree ("import_token");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "units_course_idx" ON "units" USING btree ("course_id");
  CREATE INDEX "units_updated_at_idx" ON "units" USING btree ("updated_at");
  CREATE INDEX "units_created_at_idx" ON "units" USING btree ("created_at");
  CREATE INDEX "lessons_unit_idx" ON "lessons" USING btree ("unit_id");
  CREATE INDEX "lessons_course_idx" ON "lessons" USING btree ("course_id");
  CREATE INDEX "lessons_portal_idx" ON "lessons" USING btree ("portal_id");
  CREATE INDEX "lessons_updated_at_idx" ON "lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "lessons" USING btree ("created_at");
  CREATE INDEX "resources_lesson_idx" ON "resources" USING btree ("lesson_id");
  CREATE INDEX "resources_updated_at_idx" ON "resources" USING btree ("updated_at");
  CREATE INDEX "resources_created_at_idx" ON "resources" USING btree ("created_at");
  CREATE INDEX "packs_portal_idx" ON "packs" USING btree ("portal_id");
  CREATE INDEX "packs_updated_at_idx" ON "packs" USING btree ("updated_at");
  CREATE INDEX "packs_created_at_idx" ON "packs" USING btree ("created_at");
  CREATE INDEX "packs_rels_order_idx" ON "packs_rels" USING btree ("order");
  CREATE INDEX "packs_rels_parent_idx" ON "packs_rels" USING btree ("parent_id");
  CREATE INDEX "packs_rels_path_idx" ON "packs_rels" USING btree ("path");
  CREATE INDEX "packs_rels_courses_id_idx" ON "packs_rels" USING btree ("courses_id");
  CREATE INDEX "cuts_lesson_idx" ON "cuts" USING btree ("lesson_id");
  CREATE INDEX "cuts_course_idx" ON "cuts" USING btree ("course_id");
  CREATE INDEX "cuts_seat_idx" ON "cuts" USING btree ("seat_id");
  CREATE INDEX "cuts_updated_at_idx" ON "cuts" USING btree ("updated_at");
  CREATE INDEX "cuts_created_at_idx" ON "cuts" USING btree ("created_at");
  CREATE INDEX "ladder_items_lesson_idx" ON "ladder_items" USING btree ("lesson_id");
  CREATE INDEX "ladder_items_cut_idx" ON "ladder_items" USING btree ("cut_id");
  CREATE INDEX "ladder_items_updated_at_idx" ON "ladder_items" USING btree ("updated_at");
  CREATE INDEX "ladder_items_created_at_idx" ON "ladder_items" USING btree ("created_at");
  CREATE INDEX "engagement_points_lesson_idx" ON "engagement_points" USING btree ("lesson_id");
  CREATE INDEX "engagement_points_cut_idx" ON "engagement_points" USING btree ("cut_id");
  CREATE INDEX "engagement_points_contingent_idx" ON "engagement_points" USING btree ("contingent_id");
  CREATE INDEX "engagement_points_author_idx" ON "engagement_points" USING btree ("author_id");
  CREATE INDEX "engagement_points_reviewed_by_idx" ON "engagement_points" USING btree ("reviewed_by_id");
  CREATE INDEX "engagement_points_updated_at_idx" ON "engagement_points" USING btree ("updated_at");
  CREATE INDEX "engagement_points_created_at_idx" ON "engagement_points" USING btree ("created_at");
  CREATE INDEX "engagement_points_rels_order_idx" ON "engagement_points_rels" USING btree ("order");
  CREATE INDEX "engagement_points_rels_parent_idx" ON "engagement_points_rels" USING btree ("parent_id");
  CREATE INDEX "engagement_points_rels_path_idx" ON "engagement_points_rels" USING btree ("path");
  CREATE INDEX "engagement_points_rels_users_id_idx" ON "engagement_points_rels" USING btree ("users_id");
  CREATE INDEX "answers_portal_idx" ON "answers" USING btree ("portal_id");
  CREATE INDEX "answers_point_idx" ON "answers" USING btree ("point_id");
  CREATE INDEX "answers_user_idx" ON "answers" USING btree ("user_id");
  CREATE INDEX "answers_lesson_idx" ON "answers" USING btree ("lesson_id");
  CREATE INDEX "answers_image_idx" ON "answers" USING btree ("image_id");
  CREATE INDEX "answers_audio_idx" ON "answers" USING btree ("audio_id");
  CREATE INDEX "answers_video_idx" ON "answers" USING btree ("video_id");
  CREATE INDEX "answers_cut_idx" ON "answers" USING btree ("cut_id");
  CREATE INDEX "answers_updated_at_idx" ON "answers" USING btree ("updated_at");
  CREATE INDEX "answers_created_at_idx" ON "answers" USING btree ("created_at");
  CREATE INDEX "workbook_entries_portal_idx" ON "workbook_entries" USING btree ("portal_id");
  CREATE INDEX "workbook_entries_user_idx" ON "workbook_entries" USING btree ("user_id");
  CREATE INDEX "workbook_entries_answer_idx" ON "workbook_entries" USING btree ("answer_id");
  CREATE INDEX "workbook_entries_lesson_idx" ON "workbook_entries" USING btree ("lesson_id");
  CREATE INDEX "workbook_entries_course_idx" ON "workbook_entries" USING btree ("course_id");
  CREATE INDEX "workbook_entries_image_idx" ON "workbook_entries" USING btree ("image_id");
  CREATE INDEX "workbook_entries_updated_at_idx" ON "workbook_entries" USING btree ("updated_at");
  CREATE INDEX "workbook_entries_created_at_idx" ON "workbook_entries" USING btree ("created_at");
  CREATE INDEX "notifications_portal_idx" ON "notifications" USING btree ("portal_id");
  CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
  CREATE INDEX "notifications_key_idx" ON "notifications" USING btree ("key");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "access_codes_portal_idx" ON "access_codes" USING btree ("portal_id");
  CREATE UNIQUE INDEX "access_codes_code_idx" ON "access_codes" USING btree ("code");
  CREATE INDEX "access_codes_linked_teacher_code_idx" ON "access_codes" USING btree ("linked_teacher_code_id");
  CREATE INDEX "access_codes_parent_mentor_code_idx" ON "access_codes" USING btree ("parent_mentor_code_id");
  CREATE INDEX "access_codes_updated_at_idx" ON "access_codes" USING btree ("updated_at");
  CREATE INDEX "access_codes_created_at_idx" ON "access_codes" USING btree ("created_at");
  CREATE INDEX "access_codes_rels_order_idx" ON "access_codes_rels" USING btree ("order");
  CREATE INDEX "access_codes_rels_parent_idx" ON "access_codes_rels" USING btree ("parent_id");
  CREATE INDEX "access_codes_rels_path_idx" ON "access_codes_rels" USING btree ("path");
  CREATE INDEX "access_codes_rels_packs_id_idx" ON "access_codes_rels" USING btree ("packs_id");
  CREATE INDEX "access_codes_rels_courses_id_idx" ON "access_codes_rels" USING btree ("courses_id");
  CREATE UNIQUE INDEX "talk_tiers_lesson_idx" ON "talk_tiers" USING btree ("lesson_id");
  CREATE INDEX "talk_tiers_checked_by_idx" ON "talk_tiers" USING btree ("checked_by_id");
  CREATE INDEX "talk_tiers_updated_at_idx" ON "talk_tiers" USING btree ("updated_at");
  CREATE INDEX "talk_tiers_created_at_idx" ON "talk_tiers" USING btree ("created_at");
  CREATE INDEX "adoptions_portal_idx" ON "adoptions" USING btree ("portal_id");
  CREATE INDEX "adoptions_pack_idx" ON "adoptions" USING btree ("pack_id");
  CREATE INDEX "adoptions_course_idx" ON "adoptions" USING btree ("course_id");
  CREATE INDEX "adoptions_updated_at_idx" ON "adoptions" USING btree ("updated_at");
  CREATE INDEX "adoptions_created_at_idx" ON "adoptions" USING btree ("created_at");
  CREATE INDEX "placing_questions_portal_idx" ON "placing_questions" USING btree ("portal_id");
  CREATE INDEX "placing_questions_updated_at_idx" ON "placing_questions" USING btree ("updated_at");
  CREATE INDEX "placing_questions_created_at_idx" ON "placing_questions" USING btree ("created_at");
  CREATE INDEX "placing_answers_portal_idx" ON "placing_answers" USING btree ("portal_id");
  CREATE INDEX "placing_answers_user_idx" ON "placing_answers" USING btree ("user_id");
  CREATE INDEX "placing_answers_question_idx" ON "placing_answers" USING btree ("question_id");
  CREATE INDEX "placing_answers_updated_at_idx" ON "placing_answers" USING btree ("updated_at");
  CREATE INDEX "placing_answers_created_at_idx" ON "placing_answers" USING btree ("created_at");
  CREATE INDEX "tags_clause_idx" ON "tags" USING btree ("clause_id");
  CREATE INDEX "tags_seat_idx" ON "tags" USING btree ("seat_id");
  CREATE INDEX "tags_lane_idx" ON "tags" USING btree ("lane_id");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "tags_rels_order_idx" ON "tags_rels" USING btree ("order");
  CREATE INDEX "tags_rels_parent_idx" ON "tags_rels" USING btree ("parent_id");
  CREATE INDEX "tags_rels_path_idx" ON "tags_rels" USING btree ("path");
  CREATE INDEX "tags_rels_lessons_id_idx" ON "tags_rels" USING btree ("lessons_id");
  CREATE INDEX "tags_rels_cuts_id_idx" ON "tags_rels" USING btree ("cuts_id");
  CREATE INDEX "tags_rels_engagement_points_id_idx" ON "tags_rels" USING btree ("engagement_points_id");
  CREATE INDEX "tags_rels_courses_id_idx" ON "tags_rels" USING btree ("courses_id");
  CREATE INDEX "harvest_entries_portal_idx" ON "harvest_entries" USING btree ("portal_id");
  CREATE INDEX "harvest_entries_user_idx" ON "harvest_entries" USING btree ("user_id");
  CREATE INDEX "harvest_entries_lesson_idx" ON "harvest_entries" USING btree ("lesson_id");
  CREATE INDEX "harvest_entries_updated_at_idx" ON "harvest_entries" USING btree ("updated_at");
  CREATE INDEX "harvest_entries_created_at_idx" ON "harvest_entries" USING btree ("created_at");
  CREATE INDEX "schedules_portal_idx" ON "schedules" USING btree ("portal_id");
  CREATE INDEX "schedules_owner_idx" ON "schedules" USING btree ("owner_id");
  CREATE INDEX "schedules_course_idx" ON "schedules" USING btree ("course_id");
  CREATE INDEX "schedules_pack_idx" ON "schedules" USING btree ("pack_id");
  CREATE INDEX "schedules_updated_at_idx" ON "schedules" USING btree ("updated_at");
  CREATE INDEX "schedules_created_at_idx" ON "schedules" USING btree ("created_at");
  CREATE INDEX "schedules_rels_order_idx" ON "schedules_rels" USING btree ("order");
  CREATE INDEX "schedules_rels_parent_idx" ON "schedules_rels" USING btree ("parent_id");
  CREATE INDEX "schedules_rels_path_idx" ON "schedules_rels" USING btree ("path");
  CREATE INDEX "schedules_rels_users_id_idx" ON "schedules_rels" USING btree ("users_id");
  CREATE INDEX "events_portal_idx" ON "events" USING btree ("portal_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "rsvps_portal_idx" ON "rsvps" USING btree ("portal_id");
  CREATE INDEX "rsvps_event_idx" ON "rsvps" USING btree ("event_id");
  CREATE INDEX "rsvps_user_idx" ON "rsvps" USING btree ("user_id");
  CREATE INDEX "rsvps_updated_at_idx" ON "rsvps" USING btree ("updated_at");
  CREATE INDEX "rsvps_created_at_idx" ON "rsvps" USING btree ("created_at");
  CREATE INDEX "checkins_portal_idx" ON "checkins" USING btree ("portal_id");
  CREATE INDEX "checkins_event_idx" ON "checkins" USING btree ("event_id");
  CREATE INDEX "checkins_user_idx" ON "checkins" USING btree ("user_id");
  CREATE INDEX "checkins_by_staff_idx" ON "checkins" USING btree ("by_staff_id");
  CREATE INDEX "checkins_updated_at_idx" ON "checkins" USING btree ("updated_at");
  CREATE INDEX "checkins_created_at_idx" ON "checkins" USING btree ("created_at");
  CREATE INDEX "messages_portal_idx" ON "messages" USING btree ("portal_id");
  CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE INDEX "completions_portal_idx" ON "completions" USING btree ("portal_id");
  CREATE INDEX "completions_user_idx" ON "completions" USING btree ("user_id");
  CREATE INDEX "completions_lesson_idx" ON "completions" USING btree ("lesson_id");
  CREATE INDEX "completions_updated_at_idx" ON "completions" USING btree ("updated_at");
  CREATE INDEX "completions_created_at_idx" ON "completions" USING btree ("created_at");
  CREATE INDEX "feedback_notes_portal_idx" ON "feedback_notes" USING btree ("portal_id");
  CREATE INDEX "feedback_notes_answer_idx" ON "feedback_notes" USING btree ("answer_id");
  CREATE INDEX "feedback_notes_author_idx" ON "feedback_notes" USING btree ("author_id");
  CREATE INDEX "feedback_notes_audio_idx" ON "feedback_notes" USING btree ("audio_id");
  CREATE INDEX "feedback_notes_updated_at_idx" ON "feedback_notes" USING btree ("updated_at");
  CREATE INDEX "feedback_notes_created_at_idx" ON "feedback_notes" USING btree ("created_at");
  CREATE INDEX "watch_sessions_portal_idx" ON "watch_sessions" USING btree ("portal_id");
  CREATE INDEX "watch_sessions_user_idx" ON "watch_sessions" USING btree ("user_id");
  CREATE INDEX "watch_sessions_lesson_idx" ON "watch_sessions" USING btree ("lesson_id");
  CREATE INDEX "watch_sessions_updated_at_idx" ON "watch_sessions" USING btree ("updated_at");
  CREATE INDEX "watch_sessions_created_at_idx" ON "watch_sessions" USING btree ("created_at");
  CREATE INDEX "lesson_visits_portal_idx" ON "lesson_visits" USING btree ("portal_id");
  CREATE INDEX "lesson_visits_user_idx" ON "lesson_visits" USING btree ("user_id");
  CREATE INDEX "lesson_visits_lesson_idx" ON "lesson_visits" USING btree ("lesson_id");
  CREATE INDEX "lesson_visits_updated_at_idx" ON "lesson_visits" USING btree ("updated_at");
  CREATE INDEX "lesson_visits_created_at_idx" ON "lesson_visits" USING btree ("created_at");
  CREATE INDEX "seat_visits_portal_idx" ON "seat_visits" USING btree ("portal_id");
  CREATE INDEX "seat_visits_user_idx" ON "seat_visits" USING btree ("user_id");
  CREATE INDEX "seat_visits_seat_idx" ON "seat_visits" USING btree ("seat_id");
  CREATE INDEX "seat_visits_updated_at_idx" ON "seat_visits" USING btree ("updated_at");
  CREATE INDEX "seat_visits_created_at_idx" ON "seat_visits" USING btree ("created_at");
  CREATE INDEX "rituals_portal_idx" ON "rituals" USING btree ("portal_id");
  CREATE INDEX "rituals_user_idx" ON "rituals" USING btree ("user_id");
  CREATE INDEX "rituals_updated_at_idx" ON "rituals" USING btree ("updated_at");
  CREATE INDEX "rituals_created_at_idx" ON "rituals" USING btree ("created_at");
  CREATE UNIQUE INDEX "heart_scales_key_idx" ON "heart_scales" USING btree ("key");
  CREATE INDEX "heart_scales_updated_at_idx" ON "heart_scales" USING btree ("updated_at");
  CREATE INDEX "heart_scales_created_at_idx" ON "heart_scales" USING btree ("created_at");
  CREATE INDEX "lanes_clauses_order_idx" ON "lanes_clauses" USING btree ("_order");
  CREATE INDEX "lanes_clauses_parent_id_idx" ON "lanes_clauses" USING btree ("_parent_id");
  CREATE INDEX "lanes_clauses_clause_idx" ON "lanes_clauses" USING btree ("clause_id");
  CREATE INDEX "lanes_starters_order_idx" ON "lanes_starters" USING btree ("_order");
  CREATE INDEX "lanes_starters_parent_id_idx" ON "lanes_starters" USING btree ("_parent_id");
  CREATE INDEX "lanes_starters_lesson_idx" ON "lanes_starters" USING btree ("lesson_id");
  CREATE UNIQUE INDEX "lanes_key_idx" ON "lanes" USING btree ("key");
  CREATE INDEX "lanes_scale_idx" ON "lanes" USING btree ("scale_id");
  CREATE INDEX "lanes_updated_at_idx" ON "lanes" USING btree ("updated_at");
  CREATE INDEX "lanes_created_at_idx" ON "lanes" USING btree ("created_at");
  CREATE INDEX "lanes_rels_order_idx" ON "lanes_rels" USING btree ("order");
  CREATE INDEX "lanes_rels_parent_idx" ON "lanes_rels" USING btree ("parent_id");
  CREATE INDEX "lanes_rels_path_idx" ON "lanes_rels" USING btree ("path");
  CREATE INDEX "lanes_rels_seats_id_idx" ON "lanes_rels" USING btree ("seats_id");
  CREATE INDEX "lanes_rels_clauses_id_idx" ON "lanes_rels" USING btree ("clauses_id");
  CREATE INDEX "opening_scenes_options_nudges_order_idx" ON "opening_scenes_options_nudges" USING btree ("_order");
  CREATE INDEX "opening_scenes_options_nudges_parent_id_idx" ON "opening_scenes_options_nudges" USING btree ("_parent_id");
  CREATE INDEX "opening_scenes_options_order_idx" ON "opening_scenes_options" USING btree ("_order");
  CREATE INDEX "opening_scenes_options_parent_id_idx" ON "opening_scenes_options" USING btree ("_parent_id");
  CREATE INDEX "opening_scenes_options_intent_lane_idx" ON "opening_scenes_options" USING btree ("intent_lane_id");
  CREATE UNIQUE INDEX "opening_scenes_key_idx" ON "opening_scenes" USING btree ("key");
  CREATE INDEX "opening_scenes_scene_idx" ON "opening_scenes" USING btree ("scene_id");
  CREATE INDEX "opening_scenes_updated_at_idx" ON "opening_scenes" USING btree ("updated_at");
  CREATE INDEX "opening_scenes_created_at_idx" ON "opening_scenes" USING btree ("created_at");
  CREATE INDEX "opening_configs_wording_order_idx" ON "opening_configs_wording" USING btree ("_order");
  CREATE INDEX "opening_configs_wording_parent_id_idx" ON "opening_configs_wording" USING btree ("_parent_id");
  CREATE INDEX "opening_configs_wording_scene_idx" ON "opening_configs_wording" USING btree ("scene_id");
  CREATE INDEX "opening_configs_help_contacts_order_idx" ON "opening_configs_help_contacts" USING btree ("_order");
  CREATE INDEX "opening_configs_help_contacts_parent_id_idx" ON "opening_configs_help_contacts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "opening_configs_portal_idx" ON "opening_configs" USING btree ("portal_id");
  CREATE INDEX "opening_configs_default_clip_idx" ON "opening_configs" USING btree ("default_clip_id");
  CREATE INDEX "opening_configs_updated_at_idx" ON "opening_configs" USING btree ("updated_at");
  CREATE INDEX "opening_configs_created_at_idx" ON "opening_configs" USING btree ("created_at");
  CREATE INDEX "opening_configs_rels_order_idx" ON "opening_configs_rels" USING btree ("order");
  CREATE INDEX "opening_configs_rels_parent_idx" ON "opening_configs_rels" USING btree ("parent_id");
  CREATE INDEX "opening_configs_rels_path_idx" ON "opening_configs_rels" USING btree ("path");
  CREATE INDEX "opening_configs_rels_opening_scenes_id_idx" ON "opening_configs_rels" USING btree ("opening_scenes_id");
  CREATE UNIQUE INDEX "heart_states_user_idx" ON "heart_states" USING btree ("user_id");
  CREATE INDEX "heart_states_updated_at_idx" ON "heart_states" USING btree ("updated_at");
  CREATE INDEX "heart_states_created_at_idx" ON "heart_states" USING btree ("created_at");
  CREATE INDEX "opening_answers_user_idx" ON "opening_answers" USING btree ("user_id");
  CREATE INDEX "opening_answers_portal_idx" ON "opening_answers" USING btree ("portal_id");
  CREATE INDEX "opening_answers_scene_idx" ON "opening_answers" USING btree ("scene_id");
  CREATE INDEX "opening_answers_updated_at_idx" ON "opening_answers" USING btree ("updated_at");
  CREATE INDEX "opening_answers_created_at_idx" ON "opening_answers" USING btree ("created_at");
  CREATE INDEX "opening_answers_rels_order_idx" ON "opening_answers_rels" USING btree ("order");
  CREATE INDEX "opening_answers_rels_parent_idx" ON "opening_answers_rels" USING btree ("parent_id");
  CREATE INDEX "opening_answers_rels_path_idx" ON "opening_answers_rels" USING btree ("path");
  CREATE INDEX "opening_answers_rels_users_id_idx" ON "opening_answers_rels" USING btree ("users_id");
  CREATE INDEX "heart_contributions_portal_idx" ON "heart_contributions" USING btree ("portal_id");
  CREATE INDEX "heart_contributions_nonce_hash_idx" ON "heart_contributions" USING btree ("nonce_hash");
  CREATE INDEX "heart_contributions_updated_at_idx" ON "heart_contributions" USING btree ("updated_at");
  CREATE INDEX "heart_contributions_created_at_idx" ON "heart_contributions" USING btree ("created_at");
  CREATE INDEX "view_as_sessions_actor_idx" ON "view_as_sessions" USING btree ("actor_id");
  CREATE INDEX "view_as_sessions_target_idx" ON "view_as_sessions" USING btree ("target_id");
  CREATE INDEX "view_as_sessions_portal_idx" ON "view_as_sessions" USING btree ("portal_id");
  CREATE INDEX "view_as_sessions_token_idx" ON "view_as_sessions" USING btree ("token");
  CREATE INDEX "view_as_sessions_updated_at_idx" ON "view_as_sessions" USING btree ("updated_at");
  CREATE INDEX "view_as_sessions_created_at_idx" ON "view_as_sessions" USING btree ("created_at");
  CREATE INDEX "audit_log_event_idx" ON "audit_log" USING btree ("event");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_id");
  CREATE INDEX "audit_log_portal_idx" ON "audit_log" USING btree ("portal_id");
  CREATE INDEX "audit_log_session_id_idx" ON "audit_log" USING btree ("session_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_portals_id_idx" ON "payload_locked_documents_rels" USING btree ("portals_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_clauses_id_idx" ON "payload_locked_documents_rels" USING btree ("clauses_id");
  CREATE INDEX "payload_locked_documents_rels_seats_id_idx" ON "payload_locked_documents_rels" USING btree ("seats_id");
  CREATE INDEX "payload_locked_documents_rels_shelf_items_id_idx" ON "payload_locked_documents_rels" USING btree ("shelf_items_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_units_id_idx" ON "payload_locked_documents_rels" USING btree ("units_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_resources_id_idx" ON "payload_locked_documents_rels" USING btree ("resources_id");
  CREATE INDEX "payload_locked_documents_rels_packs_id_idx" ON "payload_locked_documents_rels" USING btree ("packs_id");
  CREATE INDEX "payload_locked_documents_rels_cuts_id_idx" ON "payload_locked_documents_rels" USING btree ("cuts_id");
  CREATE INDEX "payload_locked_documents_rels_ladder_items_id_idx" ON "payload_locked_documents_rels" USING btree ("ladder_items_id");
  CREATE INDEX "payload_locked_documents_rels_engagement_points_id_idx" ON "payload_locked_documents_rels" USING btree ("engagement_points_id");
  CREATE INDEX "payload_locked_documents_rels_answers_id_idx" ON "payload_locked_documents_rels" USING btree ("answers_id");
  CREATE INDEX "payload_locked_documents_rels_workbook_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("workbook_entries_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_access_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("access_codes_id");
  CREATE INDEX "payload_locked_documents_rels_talk_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("talk_tiers_id");
  CREATE INDEX "payload_locked_documents_rels_adoptions_id_idx" ON "payload_locked_documents_rels" USING btree ("adoptions_id");
  CREATE INDEX "payload_locked_documents_rels_placing_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("placing_questions_id");
  CREATE INDEX "payload_locked_documents_rels_placing_answers_id_idx" ON "payload_locked_documents_rels" USING btree ("placing_answers_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_harvest_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("harvest_entries_id");
  CREATE INDEX "payload_locked_documents_rels_schedules_id_idx" ON "payload_locked_documents_rels" USING btree ("schedules_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_rsvps_id_idx" ON "payload_locked_documents_rels" USING btree ("rsvps_id");
  CREATE INDEX "payload_locked_documents_rels_checkins_id_idx" ON "payload_locked_documents_rels" USING btree ("checkins_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_completions_id_idx" ON "payload_locked_documents_rels" USING btree ("completions_id");
  CREATE INDEX "payload_locked_documents_rels_feedback_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("feedback_notes_id");
  CREATE INDEX "payload_locked_documents_rels_watch_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("watch_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_lesson_visits_id_idx" ON "payload_locked_documents_rels" USING btree ("lesson_visits_id");
  CREATE INDEX "payload_locked_documents_rels_seat_visits_id_idx" ON "payload_locked_documents_rels" USING btree ("seat_visits_id");
  CREATE INDEX "payload_locked_documents_rels_rituals_id_idx" ON "payload_locked_documents_rels" USING btree ("rituals_id");
  CREATE INDEX "payload_locked_documents_rels_heart_scales_id_idx" ON "payload_locked_documents_rels" USING btree ("heart_scales_id");
  CREATE INDEX "payload_locked_documents_rels_lanes_id_idx" ON "payload_locked_documents_rels" USING btree ("lanes_id");
  CREATE INDEX "payload_locked_documents_rels_opening_scenes_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_scenes_id");
  CREATE INDEX "payload_locked_documents_rels_opening_configs_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_configs_id");
  CREATE INDEX "payload_locked_documents_rels_heart_states_id_idx" ON "payload_locked_documents_rels" USING btree ("heart_states_id");
  CREATE INDEX "payload_locked_documents_rels_opening_answers_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_answers_id");
  CREATE INDEX "payload_locked_documents_rels_heart_contributions_id_idx" ON "payload_locked_documents_rels" USING btree ("heart_contributions_id");
  CREATE INDEX "payload_locked_documents_rels_view_as_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("view_as_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "portals" CASCADE;
  DROP TABLE "users_tenants" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "clauses" CASCADE;
  DROP TABLE "seats" CASCADE;
  DROP TABLE "shelf_items" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "units" CASCADE;
  DROP TABLE "lessons" CASCADE;
  DROP TABLE "resources" CASCADE;
  DROP TABLE "packs" CASCADE;
  DROP TABLE "packs_rels" CASCADE;
  DROP TABLE "cuts" CASCADE;
  DROP TABLE "ladder_items" CASCADE;
  DROP TABLE "engagement_points" CASCADE;
  DROP TABLE "engagement_points_rels" CASCADE;
  DROP TABLE "answers" CASCADE;
  DROP TABLE "workbook_entries" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "access_codes" CASCADE;
  DROP TABLE "access_codes_rels" CASCADE;
  DROP TABLE "talk_tiers" CASCADE;
  DROP TABLE "adoptions" CASCADE;
  DROP TABLE "placing_questions" CASCADE;
  DROP TABLE "placing_answers" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_rels" CASCADE;
  DROP TABLE "harvest_entries" CASCADE;
  DROP TABLE "schedules" CASCADE;
  DROP TABLE "schedules_rels" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "rsvps" CASCADE;
  DROP TABLE "checkins" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "completions" CASCADE;
  DROP TABLE "feedback_notes" CASCADE;
  DROP TABLE "watch_sessions" CASCADE;
  DROP TABLE "lesson_visits" CASCADE;
  DROP TABLE "seat_visits" CASCADE;
  DROP TABLE "rituals" CASCADE;
  DROP TABLE "heart_scales" CASCADE;
  DROP TABLE "lanes_clauses" CASCADE;
  DROP TABLE "lanes_starters" CASCADE;
  DROP TABLE "lanes" CASCADE;
  DROP TABLE "lanes_rels" CASCADE;
  DROP TABLE "opening_scenes_options_nudges" CASCADE;
  DROP TABLE "opening_scenes_options" CASCADE;
  DROP TABLE "opening_scenes" CASCADE;
  DROP TABLE "opening_configs_wording" CASCADE;
  DROP TABLE "opening_configs_help_contacts" CASCADE;
  DROP TABLE "opening_configs" CASCADE;
  DROP TABLE "opening_configs_rels" CASCADE;
  DROP TABLE "heart_states" CASCADE;
  DROP TABLE "opening_answers" CASCADE;
  DROP TABLE "opening_answers_rels" CASCADE;
  DROP TABLE "heart_contributions" CASCADE;
  DROP TABLE "view_as_sessions" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "master_flags" CASCADE;
  DROP TYPE "public"."enum_portals_kind";
  DROP TYPE "public"."enum_portals_theme";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_courses_origin";
  DROP TYPE "public"."enum_courses_visibility";
  DROP TYPE "public"."enum_lessons_transcript_source";
  DROP TYPE "public"."enum_resources_kind";
  DROP TYPE "public"."enum_packs_owner";
  DROP TYPE "public"."enum_cuts_status";
  DROP TYPE "public"."enum_cuts_presentation";
  DROP TYPE "public"."enum_ladder_items_kind";
  DROP TYPE "public"."enum_ladder_items_status";
  DROP TYPE "public"."enum_engagement_points_trigger_type";
  DROP TYPE "public"."enum_engagement_points_kind";
  DROP TYPE "public"."enum_engagement_points_timing";
  DROP TYPE "public"."enum_engagement_points_delay_unit";
  DROP TYPE "public"."enum_engagement_points_audience";
  DROP TYPE "public"."enum_engagement_points_status";
  DROP TYPE "public"."enum_access_codes_role";
  DROP TYPE "public"."enum_talk_tiers_status";
  DROP TYPE "public"."enum_adoptions_kind";
  DROP TYPE "public"."enum_tags_state";
  DROP TYPE "public"."enum_harvest_entries_kind";
  DROP TYPE "public"."enum_schedules_target_type";
  DROP TYPE "public"."enum_rsvps_ticket_kind";
  DROP TYPE "public"."enum_heart_scales_key";
  DROP TYPE "public"."enum_heart_scales_room";
  DROP TYPE "public"."enum_heart_scales_season";
  DROP TYPE "public"."enum_lanes_starters_role";
  DROP TYPE "public"."enum_lanes_fit";
  DROP TYPE "public"."enum_opening_scenes_options_nudges_scale";
  DROP TYPE "public"."enum_opening_scenes_options_sensitivity";
  DROP TYPE "public"."enum_opening_scenes_layout";
  DROP TYPE "public"."enum_opening_scenes_status";
  DROP TYPE "public"."enum_view_as_sessions_end_reason";`)
}
