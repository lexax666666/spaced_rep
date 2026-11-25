import { Test, TestingModule } from '@nestjs/testing';
import { CardTemplatesDao } from './card-templates.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, cardTemplates } from '@repo/db';

describe('CardTemplatesDao', () => {
  let dao: CardTemplatesDao;
  let db: NodePgDatabase;
  let userId: string;
  let otherUserId: string;
  let builtInId: string;
  let ownId: string;
  let othersId: string;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables(db);

    const insertedUsers = await db
      .insert(users)
      .values([{ email: 'me@example.com' }, { email: 'other@example.com' }])
      .returning();
    userId = insertedUsers[0].id;
    otherUserId = insertedUsers[1].id;

    const insertedTemplates = await db
      .insert(cardTemplates)
      .values([
        {
          name: 'Vocabulary',
          stepDefinitions: [{ type: 'RICH_TEXT', label: 'Meaning' }],
        },
        { name: 'Mine', userId },
        { name: 'Theirs', userId: otherUserId },
      ])
      .returning();
    [builtInId, ownId, othersId] = insertedTemplates.map((t) => t.id);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CardTemplatesDao, { provide: DRIZZLE_DB, useValue: db }],
    }).compile();

    dao = module.get<CardTemplatesDao>(CardTemplatesDao);
  });

  describe('getTemplatesForUser', () => {
    it("should return built-in templates and the user's own, by name", async () => {
      const result = await dao.getTemplatesForUser(userId);

      expect(result.map((template) => template.name)).toEqual([
        'Mine',
        'Vocabulary',
      ]);
    });

    it('should return the stored step definitions', async () => {
      const result = await dao.getTemplateForUser(userId, builtInId);

      expect(result?.stepDefinitions).toEqual([
        { type: 'RICH_TEXT', label: 'Meaning' },
      ]);
    });
  });

  describe('getTemplateForUser', () => {
    it('should return a built-in template', async () => {
      expect((await dao.getTemplateForUser(userId, builtInId))?.id).toBe(
        builtInId,
      );
    });

    it("should return the user's own template", async () => {
      expect((await dao.getTemplateForUser(userId, ownId))?.id).toBe(ownId);
    });

    it("should not return another user's template", async () => {
      expect(await dao.getTemplateForUser(userId, othersId)).toBeNull();
    });
  });
});
