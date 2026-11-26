-- A step now holds a question and an optional answer instead of one face.
--
-- Existing rows are not converted on purpose: each old face keeps its content as
-- the question and gets no answer, so it becomes a note. There were no cards
-- worth pairing into question and answer when this was written.
ALTER TABLE "steps" RENAME COLUMN "type" TO "question_type";--> statement-breakpoint
ALTER TABLE "steps" RENAME COLUMN "value" TO "question_value";--> statement-breakpoint
ALTER TABLE "steps" DROP CONSTRAINT "steps_type_valid";--> statement-breakpoint
ALTER TABLE "steps" DROP CONSTRAINT "steps_value_is_object";--> statement-breakpoint
ALTER TABLE "steps" DROP CONSTRAINT "steps_custom_version_matches_type";--> statement-breakpoint
ALTER TABLE "steps" ADD COLUMN "answer_type" text;--> statement-breakpoint
ALTER TABLE "steps" ADD COLUMN "answer_value" jsonb;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_question_type_valid" CHECK ("steps"."question_type" in ('RICH_TEXT', 'VIDEO', 'AUDIO', 'CHESS_POSITION', 'ANIMATION', 'CUSTOM'));--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_question_value_is_object" CHECK (jsonb_typeof("steps"."question_value") = 'object');--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_answer_type_valid" CHECK ("steps"."answer_type" in ('RICH_TEXT', 'VIDEO', 'AUDIO', 'CHESS_POSITION', 'ANIMATION'));--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_answer_value_is_object" CHECK (jsonb_typeof("steps"."answer_value") = 'object');--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_answer_is_whole" CHECK (("steps"."answer_type" is null) = ("steps"."answer_value" is null));--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_custom_version_matches_type" CHECK (("steps"."question_type" = 'CUSTOM') = ("steps"."custom_step_type_version_id" is not null));