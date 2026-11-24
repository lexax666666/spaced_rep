import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { cards } from '@repo/db';
import { eq, and, desc, isNull } from 'drizzle-orm';

export interface InsertCardInput {
  userId: string;
  deckId: string;
  // Omitted for a card built by hand rather than from a template.
  templateId?: string | null;
}

export interface CardSchedulingPatch {
  lastReviewedAt?: Date;
  nextReviewAt?: Date;
  fsrsStability?: number;
  fsrsDifficulty?: number;
  fsrsState?: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
  fsrsStep?: number;
  fsrsLapses?: number;
  reviewCount?: number;
  lastRating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
}

@Injectable()
export class CardsDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async getCardById(deckId: string, cardId: string, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    const result = await db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.id, cardId),
          eq(cards.deckId, deckId),
          isNull(cards.deletedAt),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Reads a card and locks its row until the transaction ends, so that card
   * edits and reviews of the same card run one after another.
   */
  async getCardByIdForUpdate(
    deckId: string,
    cardId: string,
    tx: NodePgDatabase,
  ) {
    const result = await tx
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.id, cardId),
          eq(cards.deckId, deckId),
          isNull(cards.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    return result[0] ?? null;
  }

  async updateCardScheduling(
    cardId: string,
    patch: CardSchedulingPatch,
    tx?: NodePgDatabase,
  ) {
    const db = tx ?? this.db;
    const result = await db
      .update(cards)
      .set(patch)
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
      .returning();

    return result[0];
  }

  async insertCard(data: InsertCardInput, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    const result = await db
      .insert(cards)
      .values({
        userId: data.userId,
        deckId: data.deckId,
        templateId: data.templateId ?? null,
      })
      .returning();

    return result[0];
  }

  async getCardsByDeckId(deckId: string, userId: string) {
    return this.db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.deckId, deckId),
          eq(cards.userId, userId),
          isNull(cards.deletedAt),
        ),
      )
      .orderBy(desc(cards.createdAt));
  }

  /**
   * Soft-deletes a card by stamping deleted_at. The row, its steps and its
   * review history stay. Returns false if there was no such live card.
   */
  async softDeleteCard(
    deckId: string,
    cardId: string,
    tx?: NodePgDatabase,
    deletedAt: Date = new Date(),
  ): Promise<boolean> {
    const db = tx ?? this.db;
    const result = await db
      .update(cards)
      .set({ deletedAt })
      .where(
        and(
          eq(cards.id, cardId),
          eq(cards.deckId, deckId),
          isNull(cards.deletedAt),
        ),
      )
      .returning({ id: cards.id });

    return result.length > 0;
  }
}
