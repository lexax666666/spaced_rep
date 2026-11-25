import { z } from 'zod';
import { nonBlankText, text } from '../common/validation';

const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt ignores everything past 72 bytes, so longer passwords are refused
// rather than silently truncated.
const MAX_PASSWORD_BYTES = 72;
const MAX_NAME_LENGTH = 200;

export const registerSchema = z.object({
  email: z.email().max(MAX_EMAIL_LENGTH),
  password: text(MAX_PASSWORD_BYTES)
    .min(MIN_PASSWORD_LENGTH)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
      `must be at most ${MAX_PASSWORD_BYTES} bytes`,
    ),
  name: nonBlankText(MAX_NAME_LENGTH).optional(),
});

// Login only checks shape. Accounts created before the registration rules
// existed must still be able to sign in with whatever email and password
// they have.
export const loginSchema = z.object({
  email: z.string().min(1).max(MAX_EMAIL_LENGTH),
  password: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
}
