-- Multi-step cards.
-- Hand-edited from the drizzle-kit output so that existing data survives:
--   * "sides" is renamed to "steps" instead of being dropped and recreated
--   * timestamps are converted to timestamptz. Columns the application writes
--     (review and due times) are read as UTC, because drizzle stored them with
--     toISOString(). created_at / updated_at were filled by DEFAULT now(), so
--     they are read in the session time zone.
--     CHECK BEFORE RUNNING: `SHOW timezone` on the target database should match
--     the time zone its sessions had when those rows were written (normally UTC).
--   * cards.template_type is mapped onto seeded built-in card_templates rows
-- The snapshot in meta/0003_snapshot.json matches the end state of this file,
-- except that steps_card_id_position_unique is DEFERRABLE here (drizzle cannot express that).

CREATE TYPE "public"."step_outcome" AS ENUM('PASSED', 'FAILED', 'SKIPPED');--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Existing tables: timestamp -> timestamptz
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "decks" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "last_reviewed_at" SET DATA TYPE timestamp with time zone USING "last_reviewed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "next_review_at" SET DATA TYPE timestamp with time zone USING "next_review_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "due_at" SET DATA TYPE timestamp with time zone USING "due_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "reviewed_at" SET DATA TYPE timestamp with time zone USING "reviewed_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "review_logs" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "sides" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint
ALTER TABLE "sides" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE current_setting('TimeZone');--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- card_templates, replacing the cards.template_type enum
-- ---------------------------------------------------------------------------
CREATE TABLE "card_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"step_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_templates_step_definitions_is_array" CHECK (jsonb_typeof("card_templates"."step_definitions") = 'array')
);
--> statement-breakpoint
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_templates_user_id_idx" ON "card_templates" USING btree ("user_id");--> statement-breakpoint

-- Built-in templates (no owner). One per former template_type value except CUSTOM.
INSERT INTO "card_templates" ("name", "step_definitions") VALUES
	('Vocabulary', '[{"type":"AUDIO","label":"Pronunciation"},{"type":"RICH_TEXT","label":"Meaning"},{"type":"RICH_TEXT","label":"Use in a sentence"}]'::jsonb),
	('Chess', '[{"type":"CHESS_POSITION","label":"Position"},{"type":"RICH_TEXT","label":"Best move"}]'::jsonb),
	('Standard flashcard', '[{"type":"RICH_TEXT","label":"Front"},{"type":"RICH_TEXT","label":"Back"}]'::jsonb);--> statement-breakpoint

ALTER TABLE "cards" ADD COLUMN "template_id" uuid;--> statement-breakpoint
-- Cards whose template_type was CUSTOM keep template_id NULL: built by hand, no template.
UPDATE "cards" SET "template_id" = "card_templates"."id"
FROM "card_templates"
WHERE "card_templates"."user_id" IS NULL
	AND "card_templates"."name" = CASE "cards"."template_type"::text
		WHEN 'VOCAB' THEN 'Vocabulary'
		WHEN 'CHESS' THEN 'Chess'
		WHEN 'STANDARD_FLASH_CARD' THEN 'Standard flashcard'
	END;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_template_id_card_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."card_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "template_type";--> statement-breakpoint
DROP TYPE "public"."card_template_type";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- custom step types and their immutable versions
-- ---------------------------------------------------------------------------
CREATE TABLE "custom_step_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_step_type_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"step_type_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"html" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"js" text DEFAULT '' NOT NULL,
	"field_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_step_type_versions_step_type_id_version_unique" UNIQUE("step_type_id","version"),
	CONSTRAINT "custom_step_type_versions_version_positive" CHECK ("custom_step_type_versions"."version" >= 1),
	CONSTRAINT "custom_step_type_versions_html_length" CHECK (length("custom_step_type_versions"."html") <= 100000),
	CONSTRAINT "custom_step_type_versions_css_length" CHECK (length("custom_step_type_versions"."css") <= 100000),
	CONSTRAINT "custom_step_type_versions_js_length" CHECK (length("custom_step_type_versions"."js") <= 100000),
	CONSTRAINT "custom_step_type_versions_field_schema_is_object" CHECK (jsonb_typeof("custom_step_type_versions"."field_schema") = 'object')
);
--> statement-breakpoint
ALTER TABLE "custom_step_types" ADD CONSTRAINT "custom_step_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_step_type_versions" ADD CONSTRAINT "custom_step_type_versions_step_type_id_custom_step_types_id_fk" FOREIGN KEY ("step_type_id") REFERENCES "public"."custom_step_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_step_types_user_id_idx" ON "custom_step_types" USING btree ("user_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- sides -> steps
-- ---------------------------------------------------------------------------
ALTER TABLE "sides" RENAME TO "steps";--> statement-breakpoint
ALTER TABLE "steps" RENAME CONSTRAINT "sides_pkey" TO "steps_pkey";--> statement-breakpoint
ALTER TABLE "steps" DROP CONSTRAINT "sides_card_id_cards_id_fk";--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- type: enum -> text + CHECK
ALTER TABLE "steps" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
DROP TYPE "public"."side_type";--> statement-breakpoint

-- position: sides had no order, so existing rows are numbered by creation time as a best effort.
ALTER TABLE "steps" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "steps" SET "position" = "ranked"."position"
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "card_id" ORDER BY "created_at", "id") AS "position"
	FROM "steps"
) AS "ranked"
WHERE "steps"."id" = "ranked"."id";--> statement-breakpoint
ALTER TABLE "steps" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "steps" ADD COLUMN "custom_step_type_version_id" uuid;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_custom_step_type_version_id_fk" FOREIGN KEY ("custom_step_type_version_id") REFERENCES "public"."custom_step_type_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- value must be a JSON object; wrap any existing scalar or array instead of failing.
UPDATE "steps" SET "value" = jsonb_build_object('value', "value") WHERE jsonb_typeof("value") <> 'object';--> statement-breakpoint

-- Deferred so that two steps can swap positions inside one transaction.
ALTER TABLE "steps" ADD CONSTRAINT "steps_card_id_position_unique" UNIQUE("card_id","position") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_position_positive" CHECK ("steps"."position" >= 1);--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_type_valid" CHECK ("steps"."type" in ('RICH_TEXT', 'VIDEO', 'AUDIO', 'CHESS_POSITION', 'ANIMATION', 'CUSTOM'));--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_custom_version_matches_type" CHECK (("steps"."type" = 'CUSTOM') = ("steps"."custom_step_type_version_id" is not null));--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_value_is_object" CHECK (jsonb_typeof("steps"."value") = 'object');--> statement-breakpoint
CREATE INDEX "steps_custom_step_type_version_id_idx" ON "steps" USING btree ("custom_step_type_version_id") WHERE "steps"."custom_step_type_version_id" is not null;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- review_step_results
-- ---------------------------------------------------------------------------
CREATE TABLE "review_step_results" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"review_log_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"outcome" "step_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_step_results_review_log_id_step_id_unique" UNIQUE("review_log_id","step_id")
);
--> statement-breakpoint
ALTER TABLE "review_step_results" ADD CONSTRAINT "review_step_results_review_log_id_review_logs_id_fk" FOREIGN KEY ("review_log_id") REFERENCES "public"."review_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_step_results" ADD CONSTRAINT "review_step_results_step_id_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_step_results_step_id_created_at_idx" ON "review_step_results" USING btree ("step_id","created_at");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Indexes missing on existing tables
-- ---------------------------------------------------------------------------
CREATE INDEX "cards_deck_id_next_review_at_idx" ON "cards" USING btree ("deck_id","next_review_at");--> statement-breakpoint
CREATE INDEX "cards_user_id_idx" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cards_template_id_idx" ON "cards" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "decks_user_id_idx" ON "decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_logs_card_id_idx" ON "review_logs" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "review_logs_user_id_idx" ON "review_logs" USING btree ("user_id");
