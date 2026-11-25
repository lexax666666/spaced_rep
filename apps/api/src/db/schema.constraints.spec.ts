import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  MAX_STEP_CODE_LENGTH,
  cards,
  customStepTypeVersions,
  customStepTypes,
  decks,
  reviewLogs,
  reviewStepResults,
  steps,
  users,
} from '@repo/db';

// Rules the database itself must enforce, whatever the application code does.
describe('schema constraints', () => {
  let db: NodePgDatabase;
  let userId: string;
  let cardId: string;
  let versionId: string;
  let stepTypeId: string;

  const richTextStep = (position: number) => ({
    cardId,
    position,
    type: 'RICH_TEXT' as const,
    label: `Step ${position}`,
    value: {},
  });

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables(db);

    const [user] = await db
      .insert(users)
      .values({ email: 'test@example.com' })
      .returning();
    userId = user.id;

    const [deck] = await db
      .insert(decks)
      .values({
        userId,
        name: 'Deck',
        newCardsPerDay: 20,
        reviewCardsPerDay: 100,
      })
      .returning();

    const [card] = await db
      .insert(cards)
      .values({ userId, deckId: deck.id })
      .returning();
    cardId = card.id;

    const [stepType] = await db
      .insert(customStepTypes)
      .values({ userId, name: 'Pronunciation recorder' })
      .returning();
    stepTypeId = stepType.id;

    const [version] = await db
      .insert(customStepTypeVersions)
      .values({ stepTypeId, version: 1, html: '<button>Record</button>' })
      .returning();
    versionId = version.id;
  });

  describe('steps', () => {
    it('should accept a CUSTOM step that references a version', async () => {
      const [step] = await db
        .insert(steps)
        .values({
          ...richTextStep(1),
          type: 'CUSTOM',
          customStepTypeVersionId: versionId,
        })
        .returning();

      expect(step.customStepTypeVersionId).toBe(versionId);
    });

    it('should reject a CUSTOM step without a version', async () => {
      await expect(
        db.insert(steps).values({ ...richTextStep(1), type: 'CUSTOM' }),
      ).rejects.toThrow();
    });

    it('should reject a built-in step that references a version', async () => {
      await expect(
        db
          .insert(steps)
          .values({ ...richTextStep(1), customStepTypeVersionId: versionId }),
      ).rejects.toThrow();
    });

    it('should reject an unknown step type', async () => {
      await expect(
        db
          .insert(steps)
          .values({ ...richTextStep(1), type: 'HOLOGRAM' as never }),
      ).rejects.toThrow();
    });

    it('should reject a value that is not a JSON object', async () => {
      await expect(
        db.insert(steps).values({ ...richTextStep(1), value: ['a'] }),
      ).rejects.toThrow();
    });

    it('should reject a position below 1', async () => {
      await expect(db.insert(steps).values(richTextStep(0))).rejects.toThrow();
    });

    it('should reject two steps of one card at the same position', async () => {
      await expect(
        db.insert(steps).values([richTextStep(1), richTextStep(1)]),
      ).rejects.toThrow();
    });

    it('should be deleted together with their card', async () => {
      await db.insert(steps).values(richTextStep(1));

      await db.delete(cards).where(eq(cards.id, cardId));

      expect(await db.select().from(steps)).toEqual([]);
    });
  });

  describe('custom step type versions', () => {
    const insertCustomStep = () =>
      db.insert(steps).values({
        ...richTextStep(1),
        type: 'CUSTOM',
        customStepTypeVersionId: versionId,
      });

    it('should not be deletable while a step uses them', async () => {
      await insertCustomStep();

      await expect(
        db
          .delete(customStepTypeVersions)
          .where(eq(customStepTypeVersions.id, versionId)),
      ).rejects.toThrow();
    });

    it('should block deleting their step type while a step uses them', async () => {
      await insertCustomStep();

      await expect(
        db.delete(customStepTypes).where(eq(customStepTypes.id, stepTypeId)),
      ).rejects.toThrow();
    });

    it('should be deleted with their step type when unused', async () => {
      await db
        .delete(customStepTypes)
        .where(eq(customStepTypes.id, stepTypeId));

      expect(await db.select().from(customStepTypeVersions)).toEqual([]);
    });

    it('should reject a repeated version number for one step type', async () => {
      await expect(
        db.insert(customStepTypeVersions).values({ stepTypeId, version: 1 }),
      ).rejects.toThrow();
    });

    it('should reject code longer than the cap', async () => {
      await expect(
        db.insert(customStepTypeVersions).values({
          stepTypeId,
          version: 2,
          js: 'x'.repeat(MAX_STEP_CODE_LENGTH + 1),
        }),
      ).rejects.toThrow();
    });

    it('should reject a field schema that is not a JSON object', async () => {
      await expect(
        db
          .insert(customStepTypeVersions)
          .values({ stepTypeId, version: 2, fieldSchema: [] }),
      ).rejects.toThrow();
    });
  });

  describe('review step results', () => {
    it('should be deleted together with their step', async () => {
      const [step] = await db.insert(steps).values(richTextStep(1)).returning();
      const [log] = await db
        .insert(reviewLogs)
        .values({
          cardId,
          userId,
          rating: 'GOOD',
          state: 'NEW',
          dueAt: new Date(),
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          lastElapsedDays: 0,
          scheduledDays: 0,
          learningStep: 0,
          reviewedAt: new Date(),
        })
        .returning();
      await db
        .insert(reviewStepResults)
        .values({ reviewLogId: log.id, stepId: step.id, outcome: 'SKIPPED' });

      await db.delete(steps).where(eq(steps.id, step.id));

      expect(await db.select().from(reviewStepResults)).toEqual([]);
    });
  });
});
