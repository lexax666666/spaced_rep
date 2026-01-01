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
});
