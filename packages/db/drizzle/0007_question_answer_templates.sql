-- The built-in templates, rewritten for steps that hold a question and an answer.
-- Each definition names the kind of content of the question and of the answer
-- ("answerType": null would be a note). They used to list one face per step.

-- Was: Pronunciation, Meaning, Use in a sentence.
UPDATE "card_templates"
SET "step_definitions" = '[{"label":"Meaning","questionType":"AUDIO","answerType":"RICH_TEXT"},{"label":"Use in a sentence","questionType":"RICH_TEXT","answerType":"RICH_TEXT"}]'::jsonb,
	"updated_at" = now()
WHERE "user_id" IS NULL AND "name" = 'Vocabulary';--> statement-breakpoint

-- Was: Position, Best move.
UPDATE "card_templates"
SET "step_definitions" = '[{"label":"Best move","questionType":"CHESS_POSITION","answerType":"RICH_TEXT"}]'::jsonb,
	"updated_at" = now()
WHERE "user_id" IS NULL AND "name" = 'Chess';--> statement-breakpoint

-- Was: Front, Back.
UPDATE "card_templates"
SET "step_definitions" = '[{"label":"Question","questionType":"RICH_TEXT","answerType":"RICH_TEXT"}]'::jsonb,
	"updated_at" = now()
WHERE "user_id" IS NULL AND "name" = 'Standard flashcard';
