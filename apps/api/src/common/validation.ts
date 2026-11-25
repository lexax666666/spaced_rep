import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Postgres rejects the NUL character in both text and jsonb.
const NUL = '\u0000';
export const containsNul = (value: unknown): boolean =>
  typeof value === 'string'
    ? value.includes(NUL)
    : (JSON.stringify(value) ?? '').includes('\\u0000');

/** A string of at most `max` characters that Postgres can store. */
export const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !containsNul(value), 'must not contain NUL characters');

/** Like `text`, but also rejects strings that are empty or only whitespace. */
export const nonBlankText = (max: number) =>
  text(max).refine((value) => value.trim() !== '', 'must not be blank');

// ['steps', 1, 'value'] -> 'steps[1].value'
const formatPath = (path: ReadonlyArray<PropertyKey>): string =>
  path.reduce<string>((formatted, key) => {
    if (typeof key === 'number') return `${formatted}[${key}]`;
    return formatted ? `${formatted}.${String(key)}` : String(key);
  }, '');

/**
 * Validates untrusted input against a schema and returns the typed result,
 * with unknown properties removed. Throws BadRequestException naming the
 * first problem.
 */
export function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = formatPath(issue.path);
  throw new BadRequestException(
    path ? `${path}: ${issue.message}` : issue.message,
  );
}

/** Nest pipe that validates a request body: `@Body(new ZodValidationPipe(schema))`. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    return parseWith(this.schema, value);
  }
}
