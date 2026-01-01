import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { decks } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface CreateDeckInput {
  name: string;
  description?: string;
  newCardsPerDay: number;
  reviewCardsPerDay: number;
  suspendNewCards?: boolean;
  fsrsRequestRetention?: number;
}

@Injectable()
export class DecksDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getDeckForUser(userId: number, deckId: string) {
    const result = await this.db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .limit(1);

    return result[0] ?? null;
  }

  async createDeck(userId: number, data: CreateDeckInput) {
    const result = await this.db
      .insert(decks)
      .values({
        userId,
        name: data.name,
        description: data.description,
        newCardsPerDay: data.newCardsPerDay,
        reviewCardsPerDay: data.reviewCardsPerDay,
        suspendNewCards: data.suspendNewCards ?? false,
        fsrsRequestRetention: data.fsrsRequestRetention ?? 0.9,
      })
      .returning();

    return result[0];
  }
}
