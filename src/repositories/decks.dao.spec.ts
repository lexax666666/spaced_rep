import { Test, TestingModule } from '@nestjs/testing';
import { DecksDao } from './decks.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema';

describe('DecksDao', () => {
  let dao: DecksDao;
  let db: NodePgDatabase;
  let testUserId: string;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    // Clear all tables before each test
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

    // Create testing module with test database
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    dao = module.get<DecksDao>(DecksDao);
  });

  describe('createDeck', () => {
    it('should create a new deck', async () => {
      const result = await dao.createDeck(testUserId, {
        name: 'Test Deck',
        description: 'A test deck',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Deck');
      expect(result.description).toBe('A test deck');
      expect(result.userId).toBe(testUserId);
      expect(result.newCardsPerDay).toBe(20);
      expect(result.reviewCardsPerDay).toBe(100);
      expect(result.fsrsRequestRetention).toBe(0.9);
    });

    it('should use default values for optional fields', async () => {
      const result = await dao.createDeck(testUserId, {
        name: 'Minimal Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      expect(result.suspendNewCards).toBe(false);
      expect(result.fsrsRequestRetention).toBe(0.9);
    });
  });

  describe('getDeckForUser', () => {
    it('should return deck when it exists for user', async () => {
      const created = await dao.createDeck(testUserId, {
        name: 'User Deck',
        newCardsPerDay: 15,
        reviewCardsPerDay: 75,
      });

      const result = await dao.getDeckForUser(testUserId, created.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
      expect(result?.name).toBe('User Deck');
    });

    it('should return null when deck does not exist', async () => {
      const result = await dao.getDeckForUser(
        testUserId,
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('should return null when deck exists but belongs to different user', async () => {
      // Create another user
      const otherUser = await db
        .insert(users)
        .values({
          email: 'other@example.com',
          name: 'Other User',
        })
        .returning();

      const created = await dao.createDeck(testUserId, {
        name: 'User 1 Deck',
        newCardsPerDay: 15,
        reviewCardsPerDay: 75,
      });

      const result = await dao.getDeckForUser(otherUser[0].id, created.id);

      expect(result).toBeNull();
    });
  });

  describe('getDecksForUser', () => {
    it('should return all decks for user ordered by createdAt desc', async () => {
      await dao.createDeck(testUserId, {
        name: 'First Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });
      await dao.createDeck(testUserId, {
        name: 'Second Deck',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      });

      const result = await dao.getDecksForUser(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Second Deck');
      expect(result[1].name).toBe('First Deck');
    });

    it('should return empty array when user has no decks', async () => {
      const result = await dao.getDecksForUser(testUserId);

      expect(result).toEqual([]);
    });

    it('should not return decks belonging to other users', async () => {
      const otherUser = await db
        .insert(users)
        .values({ email: 'other2@example.com', name: 'Other' })
        .returning();

      await dao.createDeck(testUserId, {
        name: 'My Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });
      await dao.createDeck(otherUser[0].id, {
        name: 'Their Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await dao.getDecksForUser(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Deck');
    });
  });

  describe('updateDeck', () => {
    it('should update deck fields and return updated deck', async () => {
      const created = await dao.createDeck(testUserId, {
        name: 'Original Name',
        description: 'Original description',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await dao.updateDeck(testUserId, created.id, {
        name: 'Updated Name',
        newCardsPerDay: 30,
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe('Updated Name');
      expect(result?.newCardsPerDay).toBe(30);
      // Unchanged fields should remain
      expect(result?.description).toBe('Original description');
      expect(result?.reviewCardsPerDay).toBe(50);
    });

    it('should return null when deck does not exist', async () => {
      const result = await dao.updateDeck(
        testUserId,
        '00000000-0000-0000-0000-000000000000',
        { name: 'Nope' },
      );

      expect(result).toBeNull();
    });

    it('should return null when deck belongs to different user', async () => {
      const otherUser = await db
        .insert(users)
        .values({ email: 'other3@example.com', name: 'Other' })
        .returning();

      const created = await dao.createDeck(testUserId, {
        name: 'My Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await dao.updateDeck(otherUser[0].id, created.id, {
        name: 'Stolen',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteDeck', () => {
    it('should delete deck and return true', async () => {
      const created = await dao.createDeck(testUserId, {
        name: 'To Delete',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await dao.deleteDeck(testUserId, created.id);

      expect(result).toBe(true);

      // Verify it's gone
      const found = await dao.getDeckForUser(testUserId, created.id);
      expect(found).toBeNull();
    });

    it('should return false when deck does not exist', async () => {
      const result = await dao.deleteDeck(
        testUserId,
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBe(false);
    });

    it('should return false when deck belongs to different user', async () => {
      const otherUser = await db
        .insert(users)
        .values({ email: 'other4@example.com', name: 'Other' })
        .returning();

      const created = await dao.createDeck(testUserId, {
        name: 'Protected Deck',
        newCardsPerDay: 10,
        reviewCardsPerDay: 50,
      });

      const result = await dao.deleteDeck(otherUser[0].id, created.id);

      expect(result).toBe(false);

      // Verify it still exists
      const found = await dao.getDeckForUser(testUserId, created.id);
      expect(found).toBeDefined();
    });
  });
});
