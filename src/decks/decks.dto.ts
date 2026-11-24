import { z } from 'zod';
import { nonBlankText, text } from '../common/validation';

const MAX_DECK_NAME_LENGTH = 200;
const MAX_DECK_DESCRIPTION_LENGTH = 2000;
const MAX_CARDS_PER_DAY = 10_000;

const cardsPerDay = z.number().int().min(0).max(MAX_CARDS_PER_DAY);

export const createDeckSchema = z.object({
  name: nonBlankText(MAX_DECK_NAME_LENGTH),
  // null clears the description.
  description: text(MAX_DECK_DESCRIPTION_LENGTH).nullable().optional(),
  newCardsPerDay: cardsPerDay,
  reviewCardsPerDay: cardsPerDay,
  suspendNewCards: z.boolean().optional(),
  // Target recall probability for FSRS, strictly between 0 and 1.
  fsrsRequestRetention: z.number().gt(0).lt(1).optional(),
});

// Unknown properties are dropped, so a client cannot change the owner or id.
export const updateDeckSchema = createDeckSchema
  .partial()
  .refine(
    (fields) => Object.keys(fields).length > 0,
    'at least one deck field is required',
  );

export type CreateDeckDto = z.infer<typeof createDeckSchema>;
export type UpdateDeckDto = z.infer<typeof updateDeckSchema>;
