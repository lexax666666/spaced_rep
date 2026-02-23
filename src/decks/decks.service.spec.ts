import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DecksDao } from '../repositories/decks.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema';

describe('DecksService', () => {
  let service: DecksService;
  let db: NodePgDatabase;
  let testUserId: string;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables(db);

    const userResult = await db
      .insert(users)
      .values({ email: 'test@example.com', name: 'Test User' })
      .returning();
    testUserId = userResult[0].id;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        DecksDao,
        { provide: DRIZZLE_DB, useValue: db },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  describe('create', () => {
    it('should create a deck and return it', async () => {
      const result = await service.create(testUserId, {
        name: 'Japanese N5',
        description: 'JLPT N5 vocabulary',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Japanese N5');
      expect(result.description).toBe('JLPT N5 vocabulary');
      expect(result.userId).toBe(testUserId);
    });
  });

  describe('findAll', () => {
    it('should return all decks for the user', async () => {
      await service.create(testUserId, {
        name: 'Deck 1',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });
      await service.create(testUserId, {
        name: 'Deck 2',
        newCardsPerDay: 15,
        reviewCardsPerDay: 75,
      });

      const result = await service.findAll(testUserId);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no decks', async () => {
      const result = await service.findAll(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return the deck when it exists', async () => {
      const created = await service.create(testUserId, {
        name: 'Find Me',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await service.findOne(testUserId, created.id);

      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Find Me');
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.findOne(testUserId, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the deck', async () => {
      const created = await service.create(testUserId, {
        name: 'Original',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await service.update(testUserId, created.id, {
        name: 'Updated',
        newCardsPerDay: 30,
      });

      expect(result.name).toBe('Updated');
      expect(result.newCardsPerDay).toBe(30);
      expect(result.reviewCardsPerDay).toBe(50);
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.update(testUserId, '00000000-0000-0000-0000-000000000000', {
          name: 'Nope',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete the deck without error', async () => {
      const created = await service.create(testUserId, {
        name: 'To Delete',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      await expect(
        service.remove(testUserId, created.id),
      ).resolves.toBeUndefined();

      // Verify it's gone
      await expect(
        service.findOne(testUserId, created.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.remove(testUserId, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
