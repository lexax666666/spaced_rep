import { Test, TestingModule } from '@nestjs/testing';
import { SidesDao } from './sides.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks, cards } from '../db/schema';

describe('SidesDao', () => {
  let dao: SidesDao;
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

    // Create a test card
    const cardResult = await db
      .insert(cards)
      .values({
        userId: testUserId,
        deckId: testDeckId,
        templateType: 'VOCAB',
      })
      .returning();
    testCardId = cardResult[0].id;

    // Create testing module with test database
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SidesDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    dao = module.get<SidesDao>(SidesDao);
  });

  describe('insertSides', () => {
    it('should insert multiple sides and return them', async () => {
      const result = await dao.insertSides([
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Hello' },
        },
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Back',
          value: { text: 'World' },
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBeDefined();
      expect(result[0].cardId).toBe(testCardId);
      expect(result[0].type).toBe('RICH_TEXT');
      expect(result[0].label).toBe('Front');
      expect(result[0].value).toEqual({ text: 'Hello' });
      expect(result[1].label).toBe('Back');
      expect(result[1].value).toEqual({ text: 'World' });
    });

    it('should return empty array when given empty array', async () => {
      const result = await dao.insertSides([]);

      expect(result).toEqual([]);
    });
  });

  describe('getSidesForCard', () => {
    it('should return sides for a specific card', async () => {
      await dao.insertSides([
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Question' },
        },
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Back',
          value: { text: 'Answer' },
        },
      ]);

      const result = await dao.getSidesForCard(testCardId);

      expect(result).toHaveLength(2);
      expect(result[0].cardId).toBe(testCardId);
      expect(result[1].cardId).toBe(testCardId);
    });

    it('should return empty array when card has no sides', async () => {
      const result = await dao.getSidesForCard(testCardId);

      expect(result).toEqual([]);
    });
  });

  describe('getSidesForCards', () => {
    it('should return sides for multiple cards', async () => {
      // Create a second card
      const card2Result = await db
        .insert(cards)
        .values({
          userId: testUserId,
          deckId: testDeckId,
          templateType: 'VOCAB',
        })
        .returning();
      const card2Id = card2Result[0].id;

      await dao.insertSides([
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Card 1 Front' },
        },
        {
          cardId: card2Id,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Card 2 Front' },
        },
      ]);

      const result = await dao.getSidesForCards([testCardId, card2Id]);

      expect(result).toHaveLength(2);
      const cardIds = result.map((s) => s.cardId);
      expect(cardIds).toContain(testCardId);
      expect(cardIds).toContain(card2Id);
    });

    it('should return empty array for empty cardIds', async () => {
      const result = await dao.getSidesForCards([]);

      expect(result).toEqual([]);
    });
  });

  describe('deleteSidesForCard', () => {
    it('should delete all sides for a card', async () => {
      await dao.insertSides([
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Question' },
        },
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Back',
          value: { text: 'Answer' },
        },
      ]);

      await dao.deleteSidesForCard(testCardId);

      const result = await dao.getSidesForCard(testCardId);
      expect(result).toEqual([]);
    });
  });

  describe('replaceSides', () => {
    it('should replace existing sides with new ones', async () => {
      // Insert original sides
      await dao.insertSides([
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Front',
          value: { text: 'Old Front' },
        },
        {
          cardId: testCardId,
          type: 'RICH_TEXT',
          label: 'Back',
          value: { text: 'Old Back' },
        },
      ]);

      // Replace with new sides
      const result = await dao.replaceSides(testCardId, [
        {
          type: 'RICH_TEXT',
          label: 'New Front',
          value: { text: 'New Question' },
        },
        {
          type: 'VIDEO',
          label: 'Video Side',
          value: { url: 'https://example.com/video.mp4' },
        },
        {
          type: 'AUDIO',
          label: 'Audio Side',
          value: { url: 'https://example.com/audio.mp3' },
        },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].cardId).toBe(testCardId);
      expect(result[0].label).toBe('New Front');
      expect(result[1].type).toBe('VIDEO');
      expect(result[2].type).toBe('AUDIO');

      // Verify old sides are gone
      const allSides = await dao.getSidesForCard(testCardId);
      expect(allSides).toHaveLength(3);
      const labels = allSides.map((s) => s.label);
      expect(labels).not.toContain('Front');
      expect(labels).not.toContain('Back');
    });
  });
});
