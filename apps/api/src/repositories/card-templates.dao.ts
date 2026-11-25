import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InferSelectModel, and, asc, eq, isNull, or } from 'drizzle-orm';
import { cardTemplates } from '@repo/db';

export type CardTemplate = InferSelectModel<typeof cardTemplates>;

// A user can see the built-in templates (no owner) and their own.
const visibleTo = (userId: string) =>
  or(isNull(cardTemplates.userId), eq(cardTemplates.userId, userId));

@Injectable()
export class CardTemplatesDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getTemplatesForUser(userId: string): Promise<CardTemplate[]> {
    return this.db
      .select()
      .from(cardTemplates)
      .where(visibleTo(userId))
      .orderBy(asc(cardTemplates.name), asc(cardTemplates.id));
  }

  async getTemplateForUser(
    userId: string,
    templateId: string,
  ): Promise<CardTemplate | null> {
    const result = await this.db
      .select()
      .from(cardTemplates)
      .where(and(eq(cardTemplates.id, templateId), visibleTo(userId)))
      .limit(1);

    return result[0] ?? null;
  }
}
