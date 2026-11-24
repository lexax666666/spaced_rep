import { BadRequestException } from '@nestjs/common';
import { parseWith } from '../common/validation';
import { createDeckSchema, updateDeckSchema } from './decks.dto';

describe('deck request schemas', () => {
  const validDeck = {
    name: 'Spanish',
    newCardsPerDay: 20,
    reviewCardsPerDay: 100,
  };

  describe('createDeckSchema', () => {
    it('should accept a valid deck and drop unknown properties', () => {
      const result = parseWith(createDeckSchema, {
        ...validDeck,
        fsrsRequestRetention: 0.9,
        userId: 'someone-else',
      });

      expect(result).toEqual({ ...validDeck, fsrsRequestRetention: 0.9 });
    });

    it.each([
      ['there is no body', undefined],
      ['name is missing', { newCardsPerDay: 1, reviewCardsPerDay: 1 }],
      ['name is blank', { ...validDeck, name: '  ' }],
      ['name contains a NUL character', { ...validDeck, name: 'a\u0000b' }],
      ['a daily limit is negative', { ...validDeck, newCardsPerDay: -1 }],
      ['a daily limit is fractional', { ...validDeck, reviewCardsPerDay: 1.5 }],
      ['a daily limit is a string', { ...validDeck, newCardsPerDay: '20' }],
      ['retention is 0', { ...validDeck, fsrsRequestRetention: 0 }],
      ['retention is 1', { ...validDeck, fsrsRequestRetention: 1 }],
      [
        'suspendNewCards is not a boolean',
        { ...validDeck, suspendNewCards: 'yes' },
      ],
    ])('should reject when %s', (_case, input) => {
      expect(() => parseWith(createDeckSchema, input)).toThrow(
        BadRequestException,
      );
    });

    it('should name the field in the message', () => {
      expect(() =>
        parseWith(createDeckSchema, { ...validDeck, name: ' ' }),
      ).toThrow('name: must not be blank');
    });
  });

  describe('updateDeckSchema', () => {
    it('should accept a single field', () => {
      expect(parseWith(updateDeckSchema, { name: 'Renamed' })).toEqual({
        name: 'Renamed',
      });
    });

    it('should accept null to clear the description', () => {
      expect(parseWith(updateDeckSchema, { description: null })).toEqual({
        description: null,
      });
    });

    it.each([
      ['the body is empty', {}],
      ['only unknown properties are sent', { userId: 'x', deletedAt: null }],
      ['a field has the wrong type', { newCardsPerDay: 'many' }],
      ['name is null', { name: null }],
    ])('should reject when %s', (_case, input) => {
      expect(() => parseWith(updateDeckSchema, input)).toThrow(
        BadRequestException,
      );
    });
  });
});
