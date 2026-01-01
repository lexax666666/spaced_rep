import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { reviewLogs } from '../db/schema';

export interface ReviewLogInsert {
  cardId: string;
  userId: number;
  rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
  dueAt: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  learningStep: number;
  reviewedAt: Date;
}

@Injectable()
export class ReviewLogsDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async insert(tx: NodePgDatabase, reviewRow: ReviewLogInsert) {
    const result = await tx.insert(reviewLogs).values(reviewRow).returning();

    return result[0];
  }
}
