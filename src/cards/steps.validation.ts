import { BadRequestException } from '@nestjs/common';
import { isPlainObject, isUuid } from '../common/validation';
import { CUSTOM_STEP_TYPE, STEP_TYPES, StepType } from '../db/schema';
import { SyncStepInput } from '../repositories/steps.dao';

export const MAX_STEPS_PER_CARD = 50;
export const MAX_STEP_LABEL_LENGTH = 200;

// Postgres rejects the NUL character in both text and jsonb.
const NUL = '\u0000';
const containsNul = (value: unknown): boolean =>
  JSON.stringify(value).includes('\\u0000');

const isStepType = (value: unknown): value is StepType =>
  typeof value === 'string' &&
  (STEP_TYPES as readonly string[]).includes(value);

function parseStep(input: unknown, index: number): SyncStepInput {
  const where = `steps[${index}]`;

  if (!isPlainObject(input)) {
    throw new BadRequestException(`${where} must be an object`);
  }

  const { id, type, label, value } = input;

  if (id !== undefined && !isUuid(id)) {
    throw new BadRequestException(`${where}.id must be a UUID`);
  }
  if (!isStepType(type)) {
    throw new BadRequestException(
      `${where}.type must be one of ${STEP_TYPES.join(', ')}`,
    );
  }
  if (type === CUSTOM_STEP_TYPE) {
    // Custom steps need the step type endpoints, which do not exist yet.
    throw new BadRequestException(`${where}.type CUSTOM is not supported yet`);
  }
  if (typeof label !== 'string' || label.trim() === '') {
    throw new BadRequestException(`${where}.label must be a non-empty string`);
  }
  if (label.length > MAX_STEP_LABEL_LENGTH) {
    throw new BadRequestException(
      `${where}.label must be at most ${MAX_STEP_LABEL_LENGTH} characters`,
    );
  }
  if (!isPlainObject(value)) {
    throw new BadRequestException(`${where}.value must be a JSON object`);
  }
  if (label.includes(NUL) || containsNul(value)) {
    throw new BadRequestException(`${where} must not contain NUL characters`);
  }

  return { ...(id ? { id } : {}), type, label, value };
}

/**
 * Validates the `steps` field of a request body and returns it in a typed,
 * trimmed-down form. Throws BadRequestException on the first problem.
 */
export function parseSteps(input: unknown): SyncStepInput[] {
  if (!Array.isArray(input)) {
    throw new BadRequestException('steps must be an array');
  }
  if (input.length > MAX_STEPS_PER_CARD) {
    throw new BadRequestException(
      `a card can have at most ${MAX_STEPS_PER_CARD} steps`,
    );
  }

  const parsed = input.map((step, index) => parseStep(step, index));

  const ids = parsed.flatMap((step) => (step.id ? [step.id] : []));
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('steps must not repeat an id');
  }

  return parsed;
}
