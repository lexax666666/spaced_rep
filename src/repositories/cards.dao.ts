import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { cards } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface InsertCardInput {
  userId: string;
  deckId: string;
  templateType: 'VOCAB' | 'CHESS' | 'STANDARD_FLASH_CARD' | 'CUSTOM';
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
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
      .limit(1);

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
      .where(eq(cards.id, cardId))
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
        templateType: data.templateType,
      })
      .returning();

    return result[0];
  }

  async getCardsByDeckId(deckId: string, userId: string) {
    return this.db
      .select()
      .from(cards)
      .where(and(eq(cards.deckId, deckId), eq(cards.userId, userId)))
      .orderBy(desc(cards.createdAt));
  }

  async deleteCard(deckId: string, cardId: string, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    const result = await db
      .delete(cards)
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
      .returning();

    return result.length > 0;
  }
}
