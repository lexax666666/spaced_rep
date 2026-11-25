import { BadRequestException } from '@nestjs/common';
import { parseWith } from '../common/validation';
import { loginSchema, registerSchema } from './auth.interfaces';

describe('auth request schemas', () => {
  const valid = { email: 'user@example.com', password: 'password123' };

  describe('registerSchema', () => {
    it('should accept a valid registration', () => {
      expect(parseWith(registerSchema, { ...valid, name: 'User' })).toEqual({
        ...valid,
        name: 'User',
      });
    });

    it.each([
      ['there is no body', undefined],
      ['email is missing', { password: 'password123' }],
      ['email is a number', { ...valid, email: 5 }],
      ['email is malformed', { ...valid, email: 'not-an-email' }],
      ['password is missing', { email: 'user@example.com' }],
      ['password is too short', { ...valid, password: 'short' }],
      ['password is too long', { ...valid, password: 'x'.repeat(73) }],
      [
        'password is over 72 bytes in under 72 characters',
        { ...valid, password: 'é'.repeat(40) },
      ],
      ['name is blank', { ...valid, name: ' ' }],
    ])('should reject when %s', (_case, input) => {
      expect(() => parseWith(registerSchema, input)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('loginSchema', () => {
    it('should accept a short existing password', () => {
      expect(parseWith(loginSchema, { ...valid, password: 'old' })).toEqual({
        ...valid,
        password: 'old',
      });
    });

    it('should accept an email that registration would no longer allow', () => {
      const legacy = { email: 'admin@localhost', password: 'password123' };

      expect(parseWith(loginSchema, legacy)).toEqual(legacy);
    });

    it.each([
      ['the body is empty', {}],
      ['password is empty', { ...valid, password: '' }],
      ['email is not a string', { ...valid, email: {} }],
    ])('should reject when %s', (_case, input) => {
      expect(() => parseWith(loginSchema, input)).toThrow(BadRequestException);
    });
  });
});
