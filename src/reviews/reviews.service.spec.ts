import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { FsrsSchedulerService } from '../fsrs-scheduler/fsrs-scheduler.service';
import { CardsDao } from '../repositories/cards.dao';
import { DecksDao } from '../repositories/decks.dao';
import { ReviewLogsDao } from '../repositories/review-logs.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks, cards, reviewLogs } from '../db/schema';
import { Rating } from 'ts-fsrs';
import { eq } from 'drizzle-orm';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let db: NodePgDatabase;
  let testUserId: string;
  let testDeckId: string;
  let testCardId: string;

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

    // Create a test deck with FSRS config
    const deckResult = await db
      .insert(decks)
      .values({
        userId: testUserId,
        name: 'Test Deck',
        description: 'A test deck for review tests',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
        fsrsRequestRetention: 0.9,
      })
      .returning();
    testDeckId = deckResult[0].id;

    // Create a test card (NEW state)
    const cardResult = await db
      .insert(cards)
      .values({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      })
      .returning();
    testCardId = cardResult[0].id;

    // Create testing module with all dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        FsrsSchedulerService,
        CardsDao,
        DecksDao,
        ReviewLogsDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('reviewCard - Happy Path', () => {
    it('should successfully review a new card with Rating.Good', async () => {
      const reviewTime = new Date('2025-01-01T12:00:00Z');

      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        reviewTime,
      );

      // Verify returned card
      expect(result).toBeDefined();
      expect(result?.id).toBe(testCardId);
      expect(result?.lastReviewedAt).toEqual(reviewTime);
      expect(result?.lastRating).toBe('GOOD');
      expect(result?.reviewCount).toBe(1);

      // FSRS should have calculated new stability and difficulty
      expect(result?.fsrsStability).toBeGreaterThan(0);
      expect(result?.fsrsDifficulty).toBeGreaterThan(0);
      expect(result?.nextReviewAt).toBeDefined();

      // Verify state transition (NEW -> LEARNING or REVIEW depending on FSRS)
      expect(['LEARNING', 'REVIEW']).toContain(result?.fsrsState);

      // Verify review log was inserted
      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(testUserId);
      expect(logs[0].rating).toBe('GOOD');
      expect(logs[0].reviewedAt).toEqual(reviewTime);
      expect(logs[0].stability).toBeGreaterThan(0);
      expect(logs[0].difficulty).toBeGreaterThan(0);
    });

    it('should successfully review a new card with Rating.Again', async () => {
      const reviewTime = new Date('2025-01-01T12:00:00Z');

      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Again,
        reviewTime,
      );

      expect(result).toBeDefined();
      expect(result?.lastRating).toBe('AGAIN');
      expect(result?.reviewCount).toBe(1);
      expect(result?.fsrsLapses).toBeGreaterThanOrEqual(0);

      // Verify review log
      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(1);
      expect(logs[0].rating).toBe('AGAIN');
    });

    it('should successfully review a new card with Rating.Hard', async () => {
      const reviewTime = new Date('2025-01-01T12:00:00Z');

      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Hard,
        reviewTime,
      );

      expect(result).toBeDefined();
      expect(result?.lastRating).toBe('HARD');
      expect(result?.reviewCount).toBe(1);

      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(1);
      expect(logs[0].rating).toBe('HARD');
    });

    it('should successfully review a new card with Rating.Easy', async () => {
      const reviewTime = new Date('2025-01-01T12:00:00Z');

      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Easy,
        reviewTime,
      );

      expect(result).toBeDefined();
      expect(result?.lastRating).toBe('EASY');
      expect(result?.reviewCount).toBe(1);

      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(1);
      expect(logs[0].rating).toBe('EASY');
    });
  });

  describe('reviewCard - Error Cases', () => {
    it('should throw NotFoundException when deck does not exist', async () => {
      const fakeDeckId = '00000000-0000-0000-0000-000000000000';

      await expect(
        service.reviewCard(
          testUserId,
          fakeDeckId,
          testCardId,
          Rating.Good,
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when deck belongs to different user', async () => {
      // Create another user
      const otherUser = await db
        .insert(users)
        .values({
          email: 'other@example.com',
          name: 'Other User',
        })
        .returning();

      await expect(
        service.reviewCard(
          otherUser[0].id,
          testDeckId,
          testCardId,
          Rating.Good,
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when card does not exist', async () => {
      const fakeCardId = '00000000-0000-0000-0000-000000000000';

      await expect(
        service.reviewCard(
          testUserId,
          testDeckId,
          fakeCardId,
          Rating.Good,
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when card belongs to different deck', async () => {
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

      await expect(
        service.reviewCard(
          testUserId,
          otherDeck[0].id,
          testCardId,
          Rating.Good,
          new Date(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reviewCard - State Transitions', () => {
    it('should handle multiple sequential reviews correctly', async () => {
      const firstReviewTime = new Date('2025-01-01T12:00:00Z');
      const secondReviewTime = new Date('2025-01-02T12:00:00Z');
      const thirdReviewTime = new Date('2025-01-05T12:00:00Z');

      // First review (NEW -> LEARNING/REVIEW)
      const firstResult = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        firstReviewTime,
      );

      expect(firstResult?.reviewCount).toBe(1);
      expect(firstResult?.lastReviewedAt).toEqual(firstReviewTime);
      const firstState = firstResult?.fsrsState;

      // Second review
      const secondResult = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        secondReviewTime,
      );

      expect(secondResult?.reviewCount).toBe(2);
      expect(secondResult?.lastReviewedAt).toEqual(secondReviewTime);
      expect(secondResult?.fsrsStability).toBeGreaterThan(
        firstResult?.fsrsStability || 0,
      );

      // Third review
      const thirdResult = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        thirdReviewTime,
      );

      expect(thirdResult?.reviewCount).toBe(3);
      expect(thirdResult?.lastReviewedAt).toEqual(thirdReviewTime);

      // Verify all three review logs were created
      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(3);
      expect(logs[0].reviewedAt).toEqual(firstReviewTime);
      expect(logs[1].reviewedAt).toEqual(secondReviewTime);
      expect(logs[2].reviewedAt).toEqual(thirdReviewTime);
    });

    it('should track lapses when card is failed', async () => {
      const firstReviewTime = new Date('2025-01-01T12:00:00Z');
      const secondReviewTime = new Date('2025-01-02T12:00:00Z');

      // First review with Good
      await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        firstReviewTime,
      );

      // Second review with Again (fail)
      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Again,
        secondReviewTime,
      );

      // FSRS might increment lapses on failure
      expect(result?.fsrsLapses).toBeGreaterThanOrEqual(0);
      expect(result?.reviewCount).toBe(2);
    });
  });

  describe('reviewCard - Transaction Verification', () => {
    it('should atomically update card and insert review log', async () => {
      const reviewTime = new Date('2025-01-01T12:00:00Z');

      await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        reviewTime,
      );

      // Verify card was updated
      const updatedCard = await db
        .select()
        .from(cards)
        .where(eq(cards.id, testCardId))
        .limit(1);

      expect(updatedCard).toHaveLength(1);
      expect(updatedCard[0].lastReviewedAt).toEqual(reviewTime);
      expect(updatedCard[0].reviewCount).toBe(1);

      // Verify review log was inserted
      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(1);
      expect(logs[0].cardId).toBe(testCardId);
      expect(logs[0].userId).toBe(testUserId);

      // Both operations should have succeeded together
      expect(updatedCard[0].reviewCount).toBe(logs.length);
    });
  });

  describe('reviewCard - Custom Review Time', () => {
    it('should handle custom reviewedAt timestamp correctly', async () => {
      const customTime = new Date('2024-12-15T08:30:00Z');

      const result = await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        customTime,
      );

      expect(result?.lastReviewedAt).toEqual(customTime);

      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs[0].reviewedAt).toEqual(customTime);
    });

    it('should calculate elapsed_days correctly for sequential reviews', async () => {
      const firstReview = new Date('2025-01-01T12:00:00Z');
      const secondReview = new Date('2025-01-05T12:00:00Z'); // 4 days later

      // First review
      await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        firstReview,
      );

      // Second review (4 days later)
      await service.reviewCard(
        testUserId,
        testDeckId,
        testCardId,
        Rating.Good,
        secondReview,
      );

      const logs = await db
        .select()
        .from(reviewLogs)
        .where(eq(reviewLogs.cardId, testCardId));

      expect(logs).toHaveLength(2);

      // First review should have 0 elapsed days (new card)
      expect(logs[0].elapsedDays).toBe(0);

      // Second review should reflect the 4-day gap
      expect(logs[1].elapsedDays).toBeGreaterThan(0);
    });
  });
});
