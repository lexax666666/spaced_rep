import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsDao } from '../repositories/cards.dao';
import { SidesDao } from '../repositories/sides.dao';
import { DecksDao } from '../repositories/decks.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks } from '../db/schema';

describe('CardsService', () => {
  let service: CardsService;
  let db: NodePgDatabase;
  let testUserId: string;
  let testDeckId: string;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables(db);

    // Create a test user
    const userResult = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
      })
      .returning();
    testUserId = userResult[0].id;

    // Create a test deck
    const deckResult = await db
      .insert(decks)
      .values({
        userId: testUserId,
        name: 'Test Deck',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      })
      .returning();
    testDeckId = deckResult[0].id;

    // Create testing module with test database
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        CardsDao,
        SidesDao,
        DecksDao,
        { provide: DRIZZLE_DB, useValue: db },
      ],
    }).compile();

    service = module.get<CardsService>(CardsService);
  });

  describe('create', () => {
    it('should create a card with sides and return card+sides', async () => {
      const result = await service.create(testUserId, testDeckId, {
        templateType: 'VOCAB',
        sides: [
          { type: 'RICH_TEXT', label: 'Front', value: { text: 'Hello' } },
          { type: 'RICH_TEXT', label: 'Back', value: { text: 'World' } },
        ],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.deckId).toBe(testDeckId);
      expect(result.templateType).toBe('VOCAB');
      expect(result.sides).toHaveLength(2);
      expect(result.sides[0].label).toBe('Front');
      expect(result.sides[0].value).toEqual({ text: 'Hello' });
      expect(result.sides[1].label).toBe('Back');
      expect(result.sides[1].value).toEqual({ text: 'World' });
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.create(testUserId, '00000000-0000-0000-0000-000000000000', {
          templateType: 'VOCAB',
          sides: [
            { type: 'RICH_TEXT', label: 'Front', value: { text: 'Hello' } },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all cards with their sides', async () => {
      await service.create(testUserId, testDeckId, {
        templateType: 'VOCAB',
        sides: [
          { type: 'RICH_TEXT', label: 'Front', value: { text: 'Card 1' } },
        ],
      });
      await service.create(testUserId, testDeckId, {
        templateType: 'CHESS',
        sides: [
          {
            type: 'CHESS_POSITION',
            label: 'Position',
            value: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' },
          },
        ],
      });

      const result = await service.findAll(testUserId, testDeckId);

      expect(result).toHaveLength(2);
      // Each card should have its sides attached
      expect(result[0].sides).toBeDefined();
      expect(result[0].sides.length).toBeGreaterThanOrEqual(1);
      expect(result[1].sides).toBeDefined();
      expect(result[1].sides.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when deck has no cards', async () => {
      const result = await service.findAll(testUserId, testDeckId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.findAll(
          testUserId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return card with its sides', async () => {
      const created = await service.create(testUserId, testDeckId, {
        templateType: 'VOCAB',
        sides: [
          { type: 'RICH_TEXT', label: 'Front', value: { text: 'Question' } },
          { type: 'RICH_TEXT', label: 'Back', value: { text: 'Answer' } },
        ],
      });

      const result = await service.findOne(
        testUserId,
        testDeckId,
        created.id,
      );

      expect(result.id).toBe(created.id);
      expect(result.templateType).toBe('VOCAB');
      expect(result.sides).toHaveLength(2);
    });

    it('should throw NotFoundException when card does not exist', async () => {
      await expect(
        service.findOne(
          testUserId,
          testDeckId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should replace sides and return updated card', async () => {
      const created = await service.create(testUserId, testDeckId, {
        templateType: 'VOCAB',
        sides: [
          { type: 'RICH_TEXT', label: 'Front', value: { text: 'Old' } },
        ],
      });

      const result = await service.update(
        testUserId,
        testDeckId,
        created.id,
        {
          sides: [
            {
              type: 'RICH_TEXT',
              label: 'New Front',
              value: { text: 'Updated' },
            },
            {
              type: 'VIDEO',
              label: 'Video',
              value: { url: 'https://example.com/video.mp4' },
            },
          ],
        },
      );

      expect(result.id).toBe(created.id);
      expect(result.sides).toHaveLength(2);
      expect(result.sides[0].label).toBe('New Front');
      expect(result.sides[0].value).toEqual({ text: 'Updated' });
      expect(result.sides[1].type).toBe('VIDEO');
    });

    it('should throw NotFoundException when card does not exist', async () => {
      await expect(
        service.update(
          testUserId,
          testDeckId,
          '00000000-0000-0000-0000-000000000000',
          {
            sides: [
              { type: 'RICH_TEXT', label: 'Front', value: { text: 'Nope' } },
            ],
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete card and its sides', async () => {
      const created = await service.create(testUserId, testDeckId, {
        templateType: 'VOCAB',
        sides: [
          { type: 'RICH_TEXT', label: 'Front', value: { text: 'Delete me' } },
        ],
      });

      await expect(
        service.remove(testUserId, testDeckId, created.id),
      ).resolves.toBeUndefined();

      // Verify card is gone
      await expect(
        service.findOne(testUserId, testDeckId, created.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when card does not exist', async () => {
      await expect(
        service.remove(
          testUserId,
          testDeckId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
