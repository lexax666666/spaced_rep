import { Test, TestingModule } from '@nestjs/testing';
import { StepsDao } from './steps.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, decks, cards } from '@repo/db';

describe('StepsDao', () => {
  let dao: StepsDao;
  let db: NodePgDatabase;
  let testUserId: string;
  let testDeckId: string;
  let testCardId: string;

  const insertCard = async (): Promise<string> => {
    const result = await db
      .insert(cards)
      .values({ userId: testUserId, deckId: testDeckId })
      .returning();
    return result[0].id;
  };

  const richText = (label: string) => ({
    type: 'RICH_TEXT' as const,
    label,
    value: { text: label },
  });

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

    testCardId = await insertCard();

    const module: TestingModule = await Test.createTestingModule({
      providers: [StepsDao, { provide: DRIZZLE_DB, useValue: db }],
    }).compile();

    dao = module.get<StepsDao>(StepsDao);
  });

  describe('insertStepsInOrder', () => {
    it('should insert steps and number them from 1 in the order given', async () => {
      const result = await dao.insertStepsInOrder(testCardId, [
        richText('Pronunciation'),
        richText('Meaning'),
        richText('Sentence'),
      ]);

      expect(result).toHaveLength(3);
      expect(result.map((step) => [step.label, step.position])).toEqual([
        ['Pronunciation', 1],
        ['Meaning', 2],
        ['Sentence', 3],
      ]);
      expect(result[0].id).toBeDefined();
      expect(result[0].cardId).toBe(testCardId);
      expect(result[0].type).toBe('RICH_TEXT');
      expect(result[0].value).toEqual({ text: 'Pronunciation' });
      expect(result[0].customStepTypeVersionId).toBeNull();
    });

    it('should return empty array when given empty array', async () => {
      const result = await dao.insertStepsInOrder(testCardId, []);

      expect(result).toEqual([]);
    });
  });

  describe('getStepsForCard', () => {
    it('should return steps ordered by position', async () => {
      await dao.insertSteps([
        { ...richText('Second'), cardId: testCardId, position: 2 },
        { ...richText('First'), cardId: testCardId, position: 1 },
      ]);

      const result = await dao.getStepsForCard(testCardId);

      expect(result.map((step) => step.label)).toEqual(['First', 'Second']);
    });

    it('should return empty array when card has no steps', async () => {
      const result = await dao.getStepsForCard(testCardId);

      expect(result).toEqual([]);
    });
  });

  describe('getStepsForCards', () => {
    it('should return steps for multiple cards', async () => {
      const card2Id = await insertCard();
      await dao.insertStepsInOrder(testCardId, [richText('Card 1 Front')]);
      await dao.insertStepsInOrder(card2Id, [richText('Card 2 Front')]);

      const result = await dao.getStepsForCards([testCardId, card2Id]);

      expect(result).toHaveLength(2);
      const cardIds = result.map((step) => step.cardId);
      expect(cardIds).toContain(testCardId);
      expect(cardIds).toContain(card2Id);
    });

    it('should return empty array for empty cardIds', async () => {
      const result = await dao.getStepsForCards([]);

      expect(result).toEqual([]);
    });
  });

  describe('syncSteps', () => {
    it('should keep the id of a step that is updated in place', async () => {
      const [original] = await dao.insertStepsInOrder(testCardId, [
        richText('Old label'),
      ]);

      const result = await dao.syncSteps(testCardId, [
        { id: original.id, ...richText('New label') },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(original.id);
      expect(result[0].label).toBe('New label');
      expect(result[0].value).toEqual({ text: 'New label' });
    });

    it('should swap the positions of two steps', async () => {
      const [first, second] = await dao.insertStepsInOrder(testCardId, [
        richText('First'),
        richText('Second'),
      ]);

      const result = await dao.syncSteps(testCardId, [
        { id: second.id, ...richText('Second') },
        { id: first.id, ...richText('First') },
      ]);

      expect(result.map((step) => [step.id, step.position])).toEqual([
        [second.id, 1],
        [first.id, 2],
      ]);
    });

    it('should add steps without an id and delete steps left out', async () => {
      const [kept, dropped] = await dao.insertStepsInOrder(testCardId, [
        richText('Kept'),
        richText('Dropped'),
      ]);

      const result = await dao.syncSteps(testCardId, [
        richText('Added first'),
        { id: kept.id, ...richText('Kept') },
      ]);

      expect(result.map((step) => step.label)).toEqual(['Added first', 'Kept']);
      expect(result[1].id).toBe(kept.id);
      expect(result.map((step) => step.id)).not.toContain(dropped.id);
    });

    it('should delete every step when given an empty list', async () => {
      await dao.insertStepsInOrder(testCardId, [richText('Only')]);

      const result = await dao.syncSteps(testCardId, []);

      expect(result).toEqual([]);
    });

    it("should throw when an id is not one of the card's steps", async () => {
      const otherCardId = await insertCard();
      const [foreign] = await dao.insertStepsInOrder(otherCardId, [
        richText('Other card'),
      ]);
      await dao.insertStepsInOrder(testCardId, [richText('Mine')]);

      await expect(
        dao.syncSteps(testCardId, [{ id: foreign.id, ...richText('Stolen') }]),
      ).rejects.toThrow();

      // The failed sync rolled back: both cards are as they were.
      expect(
        (await dao.getStepsForCard(testCardId)).map((s) => s.label),
      ).toEqual(['Mine']);
      expect(
        (await dao.getStepsForCard(otherCardId)).map((s) => s.label),
      ).toEqual(['Other card']);
    });

    it('should leave the steps of other cards alone', async () => {
      const otherCardId = await insertCard();
      await dao.insertStepsInOrder(otherCardId, [richText('Other card')]);
      await dao.insertStepsInOrder(testCardId, [richText('Mine')]);

      await dao.syncSteps(testCardId, []);

      expect(await dao.getStepsForCard(otherCardId)).toHaveLength(1);
    });
  });
});
