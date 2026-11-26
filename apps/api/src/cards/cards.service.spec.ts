import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsDao } from '../repositories/cards.dao';
import { StepsDao } from '../repositories/steps.dao';
import { CardTemplatesDao } from '../repositories/card-templates.dao';
import { DecksDao } from '../repositories/decks.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  users,
  decks,
  cards,
  cardTemplates,
  steps,
  reviewLogs,
} from '@repo/db';
import { and, eq, isNull } from 'drizzle-orm';

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
        StepsDao,
        CardTemplatesDao,
        DecksDao,
        { provide: DRIZZLE_DB, useValue: db },
      ],
    }).compile();

    service = module.get<CardsService>(CardsService);
  });

  describe('create', () => {
    it('should create a card with steps and return card+steps', async () => {
      const result = await service.create(testUserId, testDeckId, {
        steps: [
          {
            label: 'Meaning',
            questionType: 'AUDIO',
            questionValue: { url: 'madrugada.mp3' },
            answerType: 'RICH_TEXT',
            answerValue: { text: 'The hours before dawn' },
          },
          {
            label: 'Hook',
            questionType: 'RICH_TEXT',
            questionValue: { text: 'Same root as madrugar' },
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.deckId).toBe(testDeckId);
      expect(result.templateId).toBeNull();
      expect(result.steps).toHaveLength(2);
      // The question and the answer may be different kinds of content.
      expect(result.steps[0].label).toBe('Meaning');
      expect(result.steps[0].questionType).toBe('AUDIO');
      expect(result.steps[0].questionValue).toEqual({ url: 'madrugada.mp3' });
      expect(result.steps[0].answerType).toBe('RICH_TEXT');
      expect(result.steps[0].answerValue).toEqual({
        text: 'The hours before dawn',
      });
      // A step sent without an answer is stored as a note.
      expect(result.steps[1].label).toBe('Hook');
      expect(result.steps[1].answerType).toBeNull();
      expect(result.steps[1].answerValue).toBeNull();
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.create(testUserId, '00000000-0000-0000-0000-000000000000', {
          steps: [
            {
              questionType: 'RICH_TEXT',
              label: 'Front',
              questionValue: { text: 'Hello' },
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all cards with their steps', async () => {
      await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'Front',
            questionValue: { text: 'Card 1' },
          },
        ],
      });
      await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'CHESS_POSITION',
            label: 'Position',
            questionValue: {
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
            },
          },
        ],
      });

      const result = await service.findAll(testUserId, testDeckId);

      expect(result).toHaveLength(2);
      // Each card should have its steps attached
      expect(result[0].steps).toBeDefined();
      expect(result[0].steps.length).toBeGreaterThanOrEqual(1);
      expect(result[1].steps).toBeDefined();
      expect(result[1].steps.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when deck has no cards', async () => {
      const result = await service.findAll(testUserId, testDeckId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when deck does not exist', async () => {
      await expect(
        service.findAll(testUserId, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return card with its steps', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'Front',
            questionValue: { text: 'Question' },
          },
          {
            questionType: 'RICH_TEXT',
            label: 'Back',
            questionValue: { text: 'Answer' },
          },
        ],
      });

      const result = await service.findOne(testUserId, testDeckId, created.id);

      expect(result.id).toBe(created.id);
      expect(result.steps).toHaveLength(2);
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
    it('should replace steps and return updated card', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'Front',
            questionValue: { text: 'Old' },
          },
        ],
      });

      const result = await service.update(testUserId, testDeckId, created.id, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'New Front',
            questionValue: { text: 'Updated' },
          },
          {
            questionType: 'VIDEO',
            label: 'Video',
            questionValue: { url: 'https://example.com/video.mp4' },
          },
        ],
      });

      expect(result.id).toBe(created.id);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].label).toBe('New Front');
      expect(result.steps[0].questionValue).toEqual({ text: 'Updated' });
      expect(result.steps[1].questionType).toBe('VIDEO');
    });

    it('should throw NotFoundException when card does not exist', async () => {
      await expect(
        service.update(
          testUserId,
          testDeckId,
          '00000000-0000-0000-0000-000000000000',
          {
            steps: [
              {
                questionType: 'RICH_TEXT',
                label: 'Front',
                questionValue: { text: 'Nope' },
              },
            ],
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete card and its steps', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'Front',
            questionValue: { text: 'Delete me' },
          },
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

  describe('create - deleted decks', () => {
    it('should not create a card in a deleted deck', async () => {
      await db
        .update(decks)
        .set({ deletedAt: new Date() })
        .where(eq(decks.id, testDeckId));

      await expect(
        service.create(testUserId, testDeckId, { steps: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should never leave a live card in a deck deleted at the same time', async () => {
      const decksDao = new DecksDao(db);

      await Promise.allSettled([
        service.create(testUserId, testDeckId, { steps: [] }),
        decksDao.softDeleteDeck(testUserId, testDeckId),
      ]);

      const liveCards = await db
        .select()
        .from(cards)
        .where(and(eq(cards.deckId, testDeckId), isNull(cards.deletedAt)));
      expect(liveCards).toEqual([]);
    });
  });

  describe('create - templates', () => {
    const insertTemplate = async (userId: string | null, name: string) => {
      const [template] = await db
        .insert(cardTemplates)
        .values({ userId, name })
        .returning();
      return template;
    };

    it('should accept a built-in template', async () => {
      const template = await insertTemplate(null, 'Vocabulary');

      const result = await service.create(testUserId, testDeckId, {
        templateId: template.id,
        steps: [],
      });

      expect(result.templateId).toBe(template.id);
    });

    it("should accept the user's own template", async () => {
      const template = await insertTemplate(testUserId, 'Mine');

      const result = await service.create(testUserId, testDeckId, {
        templateId: template.id,
        steps: [],
      });

      expect(result.templateId).toBe(template.id);
    });

    it("should reject another user's template", async () => {
      const [otherUser] = await db
        .insert(users)
        .values({ email: 'other@example.com' })
        .returning();
      const template = await insertTemplate(otherUser.id, 'Theirs');

      await expect(
        service.create(testUserId, testDeckId, {
          templateId: template.id,
          steps: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject a template id that is not a UUID', async () => {
      await expect(
        service.create(testUserId, testDeckId, {
          templateId: 'VOCAB',
          steps: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - step validation', () => {
    const createWith = (step: unknown) =>
      service.create(testUserId, testDeckId, {
        steps: [step],
      } as never);

    it('should number steps from 1 in the order given', async () => {
      const result = await service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'AUDIO',
            label: 'Pronunciation',
            questionValue: { url: 'a.mp3' },
          },
          {
            questionType: 'RICH_TEXT',
            label: 'Meaning',
            questionValue: { text: 'brief' },
          },
          {
            questionType: 'ANIMATION',
            label: 'Watch',
            questionValue: { url: 'a.lottie' },
          },
        ],
      });

      expect(result.steps.map((step) => step.position)).toEqual([1, 2, 3]);
      expect(result.steps[2].questionType).toBe('ANIMATION');
    });

    it('should reject a question value that is not a JSON object', async () => {
      await expect(
        createWith({
          questionType: 'RICH_TEXT',
          label: 'Front',
          questionValue: 'text',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an unknown question type', async () => {
      await expect(
        createWith({
          questionType: 'HOLOGRAM',
          label: 'Front',
          questionValue: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a blank label', async () => {
      await expect(
        createWith({
          questionType: 'RICH_TEXT',
          label: '  ',
          questionValue: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CUSTOM steps until step types can be created', async () => {
      await expect(
        createWith({
          questionType: 'CUSTOM',
          label: 'Recorder',
          questionValue: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an answer type sent without an answer value', async () => {
      await expect(
        createWith({
          label: 'Gender',
          questionType: 'RICH_TEXT',
          questionValue: {},
          answerType: 'RICH_TEXT',
        }),
      ).rejects.toThrow(
        'steps[0]: answerType and answerValue must be sent together',
      );
    });

    it('should reject a step sent as one face with type and value', async () => {
      await expect(
        createWith({ type: 'RICH_TEXT', label: 'Front', value: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject steps that are not an array', async () => {
      await expect(
        service.create(testUserId, testDeckId, { steps: 'nope' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not create the card when a step is invalid', async () => {
      await expect(
        createWith({
          questionType: 'RICH_TEXT',
          label: 'Front',
          questionValue: [],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await service.findAll(testUserId, testDeckId)).toEqual([]);
    });
  });

  describe('update - stable step ids', () => {
    const createTwoStepCard = () =>
      service.create(testUserId, testDeckId, {
        steps: [
          {
            questionType: 'RICH_TEXT',
            label: 'First',
            questionValue: { text: '1' },
          },
          {
            questionType: 'RICH_TEXT',
            label: 'Second',
            questionValue: { text: '2' },
          },
        ],
      });

    it('should keep the id of a step sent back with its id', async () => {
      const created = await createTwoStepCard();
      const [first, second] = created.steps;

      const result = await service.update(testUserId, testDeckId, created.id, {
        steps: [
          {
            id: first.id,
            questionType: 'RICH_TEXT',
            label: 'Renamed',
            questionValue: {},
          },
          {
            id: second.id,
            questionType: 'RICH_TEXT',
            label: 'Second',
            questionValue: {},
          },
        ],
      });

      expect(result.steps.map((step) => step.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(result.steps[0].label).toBe('Renamed');
    });

    it('should remove the answer of a step sent back without one', async () => {
      const question = {
        label: 'Gender',
        questionType: 'RICH_TEXT' as const,
        questionValue: { text: 'el or la?' },
      };
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          {
            ...question,
            answerType: 'RICH_TEXT',
            answerValue: { text: 'la madrugada' },
          },
        ],
      });
      const [step] = created.steps;

      const result = await service.update(testUserId, testDeckId, created.id, {
        steps: [{ id: step.id, ...question }],
      });

      expect(result.steps[0].id).toBe(step.id);
      expect(result.steps[0].answerType).toBeNull();
      expect(result.steps[0].answerValue).toBeNull();
    });

    it('should reorder steps without changing their ids', async () => {
      const created = await createTwoStepCard();
      const [first, second] = created.steps;

      const result = await service.update(testUserId, testDeckId, created.id, {
        steps: [
          {
            id: second.id,
            questionType: 'RICH_TEXT',
            label: 'Second',
            questionValue: {},
          },
          {
            id: first.id,
            questionType: 'RICH_TEXT',
            label: 'First',
            questionValue: {},
          },
        ],
      });

      expect(result.steps.map((step) => [step.id, step.position])).toEqual([
        [second.id, 1],
        [first.id, 2],
      ]);
    });

    it('should reject a step id that belongs to another card', async () => {
      const created = await createTwoStepCard();
      const other = await createTwoStepCard();

      await expect(
        service.update(testUserId, testDeckId, created.id, {
          steps: [
            {
              id: other.steps[0].id,
              questionType: 'RICH_TEXT',
              label: 'Stolen',
              questionValue: {},
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      // Neither card changed
      const unchanged = await service.findOne(testUserId, testDeckId, other.id);
      expect(unchanged.steps.map((step) => step.label)).toEqual([
        'First',
        'Second',
      ]);
    });

    it('should reject the same step id sent twice', async () => {
      const created = await createTwoStepCard();
      const step = {
        id: created.steps[0].id,
        questionType: 'RICH_TEXT' as const,
        label: 'Twice',
        questionValue: {},
      };

      await expect(
        service.update(testUserId, testDeckId, created.id, {
          steps: [step, step],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update - concurrency', () => {
    it('should apply two simultaneous edits one after the other', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          { questionType: 'RICH_TEXT', label: 'Original', questionValue: {} },
        ],
      });
      const replaceWith = (prefix: string) =>
        service.update(testUserId, testDeckId, created.id, {
          steps: [
            {
              questionType: 'RICH_TEXT',
              label: `${prefix} 1`,
              questionValue: {},
            },
            {
              questionType: 'RICH_TEXT',
              label: `${prefix} 2`,
              questionValue: {},
            },
          ],
        });

      await Promise.all([replaceWith('A'), replaceWith('B')]);

      const result = await service.findOne(testUserId, testDeckId, created.id);
      expect(result.steps.map((step) => step.position)).toEqual([1, 2]);
      const prefixes = new Set(result.steps.map((step) => step.label[0]));
      expect(prefixes.size).toBe(1);
    });
  });

  describe('remove - steps', () => {
    it("should keep the card's steps so it can be restored", async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [
          { questionType: 'RICH_TEXT', label: 'Front', questionValue: {} },
        ],
      });

      await service.remove(testUserId, testDeckId, created.id);

      const remaining = await db
        .select()
        .from(steps)
        .where(eq(steps.cardId, created.id));
      expect(remaining).toHaveLength(1);
    });

    it('should delete a card that has review history', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [],
      });
      await db.insert(reviewLogs).values({
        cardId: created.id,
        userId: testUserId,
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
      });

      await service.remove(testUserId, testDeckId, created.id);

      await expect(
        service.findOne(testUserId, testDeckId, created.id),
      ).rejects.toThrow(NotFoundException);
      expect(await db.select().from(reviewLogs)).toHaveLength(1);
    });

    it('should not let a deleted card be edited or deleted again', async () => {
      const created = await service.create(testUserId, testDeckId, {
        steps: [],
      });
      await service.remove(testUserId, testDeckId, created.id);

      await expect(
        service.update(testUserId, testDeckId, created.id, { steps: [] }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.remove(testUserId, testDeckId, created.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
