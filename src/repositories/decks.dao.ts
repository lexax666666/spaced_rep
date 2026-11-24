import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { cards, decks } from '../db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

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
      .where(
        and(
          eq(decks.id, deckId),
          eq(decks.userId, userId),
          isNull(decks.deletedAt),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Reads a live deck and holds a shared lock on it until the transaction
   * ends, so the deck cannot be deleted while a card is being added to it.
   */
  async getDeckForUserForShare(
    userId: string,
    deckId: string,
    tx: NodePgDatabase,
  ) {
    const result = await tx
      .select()
      .from(decks)
      .where(
        and(
          eq(decks.id, deckId),
          eq(decks.userId, userId),
          isNull(decks.deletedAt),
        ),
      )
      .limit(1)
      .for('share');

    return result[0] ?? null;
  }

  async getDecksForUser(userId: string) {
    return this.db
      .select()
      .from(decks)
      .where(and(eq(decks.userId, userId), isNull(decks.deletedAt)))
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
      .where(
        and(
          eq(decks.id, deckId),
          eq(decks.userId, userId),
          isNull(decks.deletedAt),
        ),
      )
      .returning();

    return result[0] ?? null;
  }

  /**
   * Soft-deletes a deck and the cards still in it. Nothing is removed: the
   * rows are stamped with the same deleted_at, so a later restore can tell
   * which cards went with the deck. Returns false if there was no such deck.
   */
  async softDeleteDeck(
    userId: string,
    deckId: string,
    deletedAt: Date = new Date(),
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const result = await tx
        .update(decks)
        .set({ deletedAt })
        .where(
          and(
            eq(decks.id, deckId),
            eq(decks.userId, userId),
            isNull(decks.deletedAt),
          ),
        )
        .returning({ id: decks.id });

      if (result.length === 0) return false;

      await tx
        .update(cards)
        .set({ deletedAt })
        .where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)));

      return true;
    });
  }
}
