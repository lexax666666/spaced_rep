import { Test, TestingModule } from '@nestjs/testing';
import { CardsDao } from './cards.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks } from '../db/schema';

describe('CardsDao', () => {
  let dao: CardsDao;
  let db: NodePgDatabase;
  let testUserId: string;
  let testDeckId: string;

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

    // Create a test deck
    const deckResult = await db
      .insert(decks)
      .values({
        userId: testUserId,
        name: 'Test Deck',
        description: 'A test deck for card tests',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      })
      .returning();
    testDeckId = deckResult[0].id;

    // Create testing module with test database
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    dao = module.get<CardsDao>(CardsDao);
  });

  describe('insertCard', () => {
    it('should create a new card with VOCAB template type', async () => {
      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.deckId).toBe(testDeckId);
      expect(result.templateType).toBe('VOCAB');
      expect(result.fsrsState).toBe('NEW');
      expect(result.fsrsStability).toBe(0);
      expect(result.fsrsDifficulty).toBe(0);
      expect(result.reviewCount).toBe(0);
    });

    it('should create a new card with CHESS template type', async () => {
      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'CHESS',
      });

      expect(result).toBeDefined();
      expect(result.templateType).toBe('CHESS');
    });

    it('should create a new card with STANDARD_FLASH_CARD template type', async () => {
      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'STANDARD_FLASH_CARD',
      });

      expect(result).toBeDefined();
      expect(result.templateType).toBe('STANDARD_FLASH_CARD');
    });

    it('should create a new card with CUSTOM template type', async () => {
      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'CUSTOM',
      });

      expect(result).toBeDefined();
      expect(result.templateType).toBe('CUSTOM');
    });
  });

  describe('getCardById', () => {
    it('should return card when it exists for the deck', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      const result = await dao.getCardById(testDeckId, created.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
      expect(result?.deckId).toBe(testDeckId);
      expect(result?.userId).toBe(testUserId);
      expect(result?.templateType).toBe('VOCAB');
    });

    it('should return null when card does not exist', async () => {
      const result = await dao.getCardById(
        testDeckId,
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('should return null when card exists but belongs to different deck', async () => {
      // Create another deck
      const otherDeck = await db
        .insert(decks)
        .values({
          userId: testUserId,
          name: 'Other Deck',
          newCardsPerDay: 10,
          reviewCardsPerDay: 50,
        })
        .returning();

      // Create card in first deck
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      // Try to get it with wrong deck ID
      const result = await dao.getCardById(otherDeck[0].id, created.id);

      expect(result).toBeNull();
    });
  });

  describe('updateCardScheduling', () => {
    it('should update card scheduling fields', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const result = await dao.updateCardScheduling(db, created.id, {
        lastReviewedAt: now,
        nextReviewAt: tomorrow,
        fsrsStability: 5.5,
        fsrsDifficulty: 3.2,
        fsrsState: 'REVIEW',
        fsrsStep: 2,
        fsrsLapses: 1,
        reviewCount: 3,
        lastRating: 'GOOD',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.lastReviewedAt).toEqual(now);
      expect(result.nextReviewAt).toEqual(tomorrow);
      expect(result.fsrsStability).toBe(5.5);
      expect(result.fsrsDifficulty).toBe(3.2);
      expect(result.fsrsState).toBe('REVIEW');
      expect(result.fsrsStep).toBe(2);
      expect(result.fsrsLapses).toBe(1);
      expect(result.reviewCount).toBe(3);
      expect(result.lastRating).toBe('GOOD');
    });

    it('should allow partial updates', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      // Only update a few fields
      const result = await dao.updateCardScheduling(db, created.id, {
        fsrsStability: 2.5,
        reviewCount: 1,
      });

      expect(result.fsrsStability).toBe(2.5);
      expect(result.reviewCount).toBe(1);
      // Other fields should remain at their defaults
      expect(result.fsrsState).toBe('NEW');
      expect(result.fsrsLapses).toBe(0);
    });

    it('should update state transitions correctly', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      // Move from NEW to LEARNING
      const learning = await dao.updateCardScheduling(db, created.id, {
        fsrsState: 'LEARNING',
        fsrsStep: 1,
      });
      expect(learning.fsrsState).toBe('LEARNING');
      expect(learning.fsrsStep).toBe(1);

      // Move from LEARNING to REVIEW
      const review = await dao.updateCardScheduling(db, created.id, {
        fsrsState: 'REVIEW',
        fsrsStability: 10.0,
        fsrsDifficulty: 5.0,
      });
      expect(review.fsrsState).toBe('REVIEW');
      expect(review.fsrsStability).toBe(10.0);
      expect(review.fsrsDifficulty).toBe(5.0);
    });

    it('should update lastRating correctly', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      });

      const ratings: Array<'AGAIN' | 'HARD' | 'GOOD' | 'EASY'> = [
        'AGAIN',
        'HARD',
        'GOOD',
        'EASY',
      ];

      for (const rating of ratings) {
        const result = await dao.updateCardScheduling(db, created.id, {
          lastRating: rating,
        });
        expect(result.lastRating).toBe(rating);
      }
    });
  });
});
