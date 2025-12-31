CREATE TYPE "public"."card_template_type" AS ENUM('VOCAB', 'CHESS', 'STANDARD_FLASH_CARD', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."fsrs_state" AS ENUM('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');--> statement-breakpoint
CREATE TYPE "public"."review_rating" AS ENUM('AGAIN', 'HARD', 'GOOD', 'EASY');--> statement-breakpoint
CREATE TYPE "public"."scheduler_type" AS ENUM('SM2', 'FSRS');--> statement-breakpoint
CREATE TYPE "public"."side_type" AS ENUM('RICH_TEXT', 'VIDEO', 'AUDIO', 'CHESS_POSITION');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"deck_id" uuid NOT NULL,
	"template_type" "card_template_type" NOT NULL,
	"last_reviewed_at" timestamp,
	"next_review_at" timestamp,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease_factor" double precision DEFAULT 2.5 NOT NULL,
	"repetition" integer DEFAULT 0 NOT NULL,
	"quality" integer,
	"last_rating" "review_rating",
	"fsrs_stability" double precision DEFAULT 0 NOT NULL,
	"fsrs_difficulty" double precision DEFAULT 0 NOT NULL,
	"fsrs_state" "fsrs_state" DEFAULT 'NEW' NOT NULL,
	"fsrs_step" integer DEFAULT 0 NOT NULL,
	"fsrs_lapses" integer DEFAULT 0 NOT NULL,
	"scheduler" "scheduler_type" DEFAULT 'SM2' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"new_cards_per_day" integer NOT NULL,
	"review_cards_per_day" integer NOT NULL,
	"suspend_new_cards" boolean DEFAULT false NOT NULL,
	"fsrs_request_retention" double precision DEFAULT 0.9 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"rating" "review_rating" NOT NULL,
	"state" "fsrs_state" NOT NULL,
	"due_at" timestamp NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"elapsed_days" integer NOT NULL,
	"last_elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_step" integer NOT NULL,
	"reviewed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sides" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"type" "side_type" NOT NULL,
	"label" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sides" ADD CONSTRAINT "sides_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;