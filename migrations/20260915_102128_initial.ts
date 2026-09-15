import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_notes_subject" AS ENUM('sociology', 'anthropology', 'polsci', 'geography', 'pub-admin');
  CREATE TYPE "payload"."enum_notes_paper" AS ENUM('1', '2');
  CREATE TYPE "payload"."enum_notes_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__notes_v_version_subject" AS ENUM('sociology', 'anthropology', 'polsci', 'geography', 'pub-admin');
  CREATE TYPE "payload"."enum__notes_v_version_paper" AS ENUM('1', '2');
  CREATE TYPE "payload"."enum__notes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_announcements_kind" AS ENUM('announcement', 'note', 'current_affairs');
  CREATE TABLE "payload"."cms_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."cms_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."notes_subtopics" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "payload"."notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"subject" "payload"."enum_notes_subject",
  	"paper" "payload"."enum_notes_paper",
  	"section" varchar,
  	"topic" numeric,
  	"description" varchar,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_notes_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_notes_v_version_subtopics" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_notes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_subject" "payload"."enum__notes_v_version_subject",
  	"version_paper" "payload"."enum__notes_v_version_paper",
  	"version_section" varchar,
  	"version_topic" numeric,
  	"version_description" varchar,
  	"version_content" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__notes_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"link" varchar,
  	"kind" "payload"."enum_announcements_kind" DEFAULT 'announcement' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer,
  	"notes_id" integer,
  	"announcements_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_users_sessions" ADD CONSTRAINT "cms_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."notes_subtopics" ADD CONSTRAINT "notes_subtopics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_notes_v_version_subtopics" ADD CONSTRAINT "_notes_v_version_subtopics_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_notes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_notes_v" ADD CONSTRAINT "_notes_v_parent_id_notes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."notes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notes_fk" FOREIGN KEY ("notes_id") REFERENCES "payload"."notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "payload"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_users_sessions_order_idx" ON "payload"."cms_users_sessions" USING btree ("_order");
  CREATE INDEX "cms_users_sessions_parent_id_idx" ON "payload"."cms_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "cms_users_updated_at_idx" ON "payload"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "payload"."cms_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_users_email_idx" ON "payload"."cms_users" USING btree ("email");
  CREATE INDEX "notes_subtopics_order_idx" ON "payload"."notes_subtopics" USING btree ("_order");
  CREATE INDEX "notes_subtopics_parent_id_idx" ON "payload"."notes_subtopics" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "notes_slug_idx" ON "payload"."notes" USING btree ("slug");
  CREATE INDEX "notes_updated_at_idx" ON "payload"."notes" USING btree ("updated_at");
  CREATE INDEX "notes_created_at_idx" ON "payload"."notes" USING btree ("created_at");
  CREATE INDEX "notes__status_idx" ON "payload"."notes" USING btree ("_status");
  CREATE INDEX "_notes_v_version_subtopics_order_idx" ON "payload"."_notes_v_version_subtopics" USING btree ("_order");
  CREATE INDEX "_notes_v_version_subtopics_parent_id_idx" ON "payload"."_notes_v_version_subtopics" USING btree ("_parent_id");
  CREATE INDEX "_notes_v_parent_idx" ON "payload"."_notes_v" USING btree ("parent_id");
  CREATE INDEX "_notes_v_version_version_slug_idx" ON "payload"."_notes_v" USING btree ("version_slug");
  CREATE INDEX "_notes_v_version_version_updated_at_idx" ON "payload"."_notes_v" USING btree ("version_updated_at");
  CREATE INDEX "_notes_v_version_version_created_at_idx" ON "payload"."_notes_v" USING btree ("version_created_at");
  CREATE INDEX "_notes_v_version_version__status_idx" ON "payload"."_notes_v" USING btree ("version__status");
  CREATE INDEX "_notes_v_created_at_idx" ON "payload"."_notes_v" USING btree ("created_at");
  CREATE INDEX "_notes_v_updated_at_idx" ON "payload"."_notes_v" USING btree ("updated_at");
  CREATE INDEX "_notes_v_latest_idx" ON "payload"."_notes_v" USING btree ("latest");
  CREATE INDEX "announcements_updated_at_idx" ON "payload"."announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "payload"."announcements" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_locked_documents_rels_notes_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("notes_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_users_sessions" CASCADE;
  DROP TABLE "payload"."cms_users" CASCADE;
  DROP TABLE "payload"."notes_subtopics" CASCADE;
  DROP TABLE "payload"."notes" CASCADE;
  DROP TABLE "payload"."_notes_v_version_subtopics" CASCADE;
  DROP TABLE "payload"."_notes_v" CASCADE;
  DROP TABLE "payload"."announcements" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_notes_subject";
  DROP TYPE "payload"."enum_notes_paper";
  DROP TYPE "payload"."enum_notes_status";
  DROP TYPE "payload"."enum__notes_v_version_subject";
  DROP TYPE "payload"."enum__notes_v_version_paper";
  DROP TYPE "payload"."enum__notes_v_version_status";
  DROP TYPE "payload"."enum_announcements_kind";`)
}
