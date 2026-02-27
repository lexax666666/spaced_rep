import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { decks } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface CreateDeckInput {
  name: string;
  description?: string;
  newCardsPerDay: number;
  reviewCardsPerDay: number;
  suspendNewCards?: boolean;
  fsrsRequestRetention?: number;
}

export interface UpdateDeckInput {
  name?: string;
  description?: string;
  newCardsPerDay?: number;
  reviewCardsPerDay?: number;
  suspendNewCards?: boolean;
  fsrsRequestRetention?: number;
}

@Injectable()
export class DecksDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getDeckForUser(userId: string, deckId: string, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    const result = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .limit(1);

    return result[0] ?? null;
  }

  async getDecksForUser(userId: string) {
    return this.db
      .select()
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.createdAt));
  }

  async createDeck(userId: string, data: CreateDeckInput, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    const result = await db
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

  async updateDeck(userId: string, deckId: string, data: UpdateDeckInput) {
    const result = await this.db
      .update(decks)
      .set(data)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .returning();

    return result[0] ?? null;
  }

  async deleteDeck(userId: string, deckId: string) {
    const result = await this.db
      .delete(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .returning();

    return result.length > 0;
  }
}
