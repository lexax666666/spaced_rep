import { Test, TestingModule } from '@nestjs/testing';
import { CardsDao } from './cards.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks, cards, cardTemplates } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    it('should create a new card without a template', async () => {
      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.deckId).toBe(testDeckId);
      expect(result.templateId).toBeNull();
      expect(result.fsrsState).toBe('NEW');
      expect(result.fsrsStability).toBe(0);
      expect(result.fsrsDifficulty).toBe(0);
      expect(result.reviewCount).toBe(0);
    });

    it('should create a new card that references a template', async () => {
      const [template] = await db
        .insert(cardTemplates)
        .values({ name: 'Vocabulary' })
        .returning();

      const result = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
        templateId: template.id,
      });

      expect(result.templateId).toBe(template.id);
    });

    it('should store timestamps with a time zone', async () => {
      const nextReviewAt = new Date('2026-03-01T12:00:00.000Z');
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      await dao.updateCardScheduling(created.id, { nextReviewAt });

      const result = await dao.getCardById(testDeckId, created.id);
      expect(result?.nextReviewAt).toEqual(nextReviewAt);
    });
  });

  describe('getCardById', () => {
    it('should return card when it exists for the deck', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      const result = await dao.getCardById(testDeckId, created.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
      expect(result?.deckId).toBe(testDeckId);
      expect(result?.userId).toBe(testUserId);
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
      });

      // Try to get it with wrong deck ID
      const result = await dao.getCardById(otherDeck[0].id, created.id);

      expect(result).toBeNull();
    });
  });

  describe('getCardsByDeckId', () => {
    it('should return all cards for a deck ordered by createdAt desc', async () => {
      const first = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });
      const second = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      const result = await dao.getCardsByDeckId(testDeckId, testUserId);

      expect(result).toHaveLength(2);
      // Ordered by createdAt desc, so the second inserted card comes first
      expect(result[0].id).toBe(second.id);
      expect(result[1].id).toBe(first.id);
    });

    it('should return empty array when deck has no cards', async () => {
      const result = await dao.getCardsByDeckId(testDeckId, testUserId);

      expect(result).toEqual([]);
    });

    it('should not return cards from other decks', async () => {
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

      await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });
      await dao.insertCard({
        userId: testUserId,
        deckId: otherDeck[0].id,
      });

      const result = await dao.getCardsByDeckId(testDeckId, testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].deckId).toBe(testDeckId);
    });
  });

  describe('softDeleteCard', () => {
    it('should delete card and return true', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      const result = await dao.softDeleteCard(testDeckId, created.id);

      expect(result).toBe(true);

      // Verify it's gone
      const found = await dao.getCardById(testDeckId, created.id);
      expect(found).toBeNull();
    });

    it('should keep the row and stamp deleted_at', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      await dao.softDeleteCard(testDeckId, created.id);

      const rows = await db
        .select()
        .from(cards)
        .where(eq(cards.id, created.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).toBeInstanceOf(Date);
    });

    it('should hide the card from deck listings', async () => {
      const kept = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });
      const deleted = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      await dao.softDeleteCard(testDeckId, deleted.id);

      const result = await dao.getCardsByDeckId(testDeckId, testUserId);
      expect(result.map((card) => card.id)).toEqual([kept.id]);
    });

    it('should return false when the card is already deleted', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });
      await dao.softDeleteCard(testDeckId, created.id);

      expect(await dao.softDeleteCard(testDeckId, created.id)).toBe(false);
    });

    it('should return false when card does not exist', async () => {
      const result = await dao.softDeleteCard(
        testDeckId,
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBe(false);
    });

    it('should return false when card belongs to different deck', async () => {
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

      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      // Try to delete with wrong deck ID
      const result = await dao.softDeleteCard(otherDeck[0].id, created.id);

      expect(result).toBe(false);

      // Verify it still exists
      const found = await dao.getCardById(testDeckId, created.id);
      expect(found).toBeDefined();
    });
  });

  describe('updateCardScheduling - deleted cards', () => {
    it('should leave a deleted card untouched', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });
      await dao.softDeleteCard(testDeckId, created.id);

      const result = await dao.updateCardScheduling(created.id, {
        reviewCount: 9,
      });

      expect(result).toBeUndefined();
      const [row] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, created.id));
      expect(row.reviewCount).toBe(0);
    });
  });

  describe('updateCardScheduling', () => {
    it('should update card scheduling fields', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const result = await dao.updateCardScheduling(
        created.id,
        {
          lastReviewedAt: now,
          nextReviewAt: tomorrow,
          fsrsStability: 5.5,
          fsrsDifficulty: 3.2,
          fsrsState: 'REVIEW',
          fsrsStep: 2,
          fsrsLapses: 1,
          reviewCount: 3,
          lastRating: 'GOOD',
        },
        db,
      );

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
      });

      // Only update a few fields
      const result = await dao.updateCardScheduling(
        created.id,
        {
          fsrsStability: 2.5,
          reviewCount: 1,
        },
        db,
      );

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
      });

      // Move from NEW to LEARNING
      const learning = await dao.updateCardScheduling(
        created.id,
        {
          fsrsState: 'LEARNING',
          fsrsStep: 1,
        },
        db,
      );
      expect(learning.fsrsState).toBe('LEARNING');
      expect(learning.fsrsStep).toBe(1);

      // Move from LEARNING to REVIEW
      const review = await dao.updateCardScheduling(
        created.id,
        {
          fsrsState: 'REVIEW',
          fsrsStability: 10.0,
          fsrsDifficulty: 5.0,
        },
        db,
      );
      expect(review.fsrsState).toBe('REVIEW');
      expect(review.fsrsStability).toBe(10.0);
      expect(review.fsrsDifficulty).toBe(5.0);
    });

    it('should update lastRating correctly', async () => {
      const created = await dao.insertCard({
        userId: testUserId,
        deckId: testDeckId,
      });

      const ratings: Array<'AGAIN' | 'HARD' | 'GOOD' | 'EASY'> = [
        'AGAIN',
        'HARD',
        'GOOD',
        'EASY',
      ];

      for (const rating of ratings) {
        const result = await dao.updateCardScheduling(
          created.id,
          {
            lastRating: rating,
          },
          db,
        );
        expect(result.lastRating).toBe(rating);
      }
    });
  });
});
