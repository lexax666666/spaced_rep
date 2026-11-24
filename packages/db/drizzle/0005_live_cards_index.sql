DROP INDEX "cards_deck_id_next_review_at_idx";--> statement-breakpoint
CREATE INDEX "cards_deck_id_idx" ON "cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "cards_live_deck_id_next_review_at_idx" ON "cards" USING btree ("deck_id","next_review_at") WHERE "cards"."deleted_at" is null;