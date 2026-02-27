import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sides } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

export interface InsertSideInput {
  cardId: string;
  type: 'RICH_TEXT' | 'VIDEO' | 'AUDIO' | 'CHESS_POSITION';
  label: string;
  value: unknown;
}

@Injectable()
export class SidesDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async insertSides(data: InsertSideInput[], tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    if (data.length === 0) return [];

    const result = await db
      .insert(sides)
      .values(data)
      .returning();

    return result;
  }

  async getSidesForCard(cardId: string) {
    return this.db
      .select()
      .from(sides)
      .where(eq(sides.cardId, cardId));
  }

  async getSidesForCards(cardIds: string[]) {
    if (cardIds.length === 0) return [];

    return this.db
      .select()
      .from(sides)
      .where(inArray(sides.cardId, cardIds));
  }

  async deleteSidesForCard(cardId: string, tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    await db
      .delete(sides)
      .where(eq(sides.cardId, cardId));
  }

  async replaceSides(cardId: string, data: Omit<InsertSideInput, 'cardId'>[], tx?: NodePgDatabase) {
    const db = tx ?? this.db;
    await db.delete(sides).where(eq(sides.cardId, cardId));

    if (data.length === 0) return [];

    const result = await db
      .insert(sides)
      .values(data.map((s) => ({ ...s, cardId })))
      .returning();

    return result;
  }
}
