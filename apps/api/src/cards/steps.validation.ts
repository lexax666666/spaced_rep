import { z } from 'zod';
import {
  containsNul,
  isPlainObject,
  isUuid,
  nonBlankText,
  parseWith,
} from '../common/validation';
import { CUSTOM_STEP_TYPE, STEP_TYPES } from '@repo/db';
import { SyncStepInput } from '../repositories/steps.dao';

export const MAX_STEPS_PER_CARD = 50;
export const MAX_STEP_LABEL_LENGTH = 200;

const stepSchema = z.object({
  // Only on update: the id of an existing step to keep.
  id: z.custom<string>(isUuid, 'must be a UUID').optional(),
  type: z
    .enum(STEP_TYPES)
    // Custom steps need the step type endpoints, which do not exist yet.
    .refine((type) => type !== CUSTOM_STEP_TYPE, 'CUSTOM is not supported yet'),
  label: nonBlankText(MAX_STEP_LABEL_LENGTH),
  value: z
    .custom<Record<string, unknown>>(isPlainObject, 'must be a JSON object')
    .refine((value) => !containsNul(value), 'must not contain NUL characters'),
});

export const stepsSchema = z
  .array(stepSchema, 'must be an array')
  .max(MAX_STEPS_PER_CARD)
  .refine((steps) => {
    const ids = steps.flatMap((step) => (step.id ? [step.id] : []));
    return new Set(ids).size === ids.length;
  }, 'must not repeat an id');

/**
 * Validates the `steps` field of a request body and returns it typed, with
 * unknown properties removed. Throws BadRequestException on the first problem.
 */
export function parseSteps(input: unknown): SyncStepInput[] {
  return parseWith(z.object({ steps: stepsSchema }), { steps: input }).steps;
}
