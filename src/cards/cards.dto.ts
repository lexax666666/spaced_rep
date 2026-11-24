import { z } from 'zod';
import { isUuid } from '../common/validation';
import { stepsSchema } from './steps.validation';

export const createCardSchema = z.object({
  // Omit for a card built by hand rather than from a template.
  templateId: z.custom<string>(isUuid, 'must be a UUID').nullable().optional(),
  steps: stepsSchema.default([]),
});

export const updateCardSchema = z.object({
  // The card's full list of steps, in order. A step sent with its id is kept;
  // existing steps left out are deleted.
  steps: stepsSchema,
});

// What clients send. Parsing fills in defaults, so the input types are looser.
export type CreateCardDto = z.input<typeof createCardSchema>;
export type UpdateCardDto = z.input<typeof updateCardSchema>;
export type StepDto = CreateCardDto extends { steps?: (infer S)[] } ? S : never;
