const UNIQUE_VIOLATION = '23505';

const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;

/**
 * True when a database error is a unique-constraint violation. Drizzle wraps
 * the driver's error, so the Postgres code may sit on the error or its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (errorCode(error) === UNIQUE_VIOLATION) return true;

  const cause =
    typeof error === 'object' && error !== null && 'cause' in error
      ? error.cause
      : undefined;
  return errorCode(cause) === UNIQUE_VIOLATION;
}
