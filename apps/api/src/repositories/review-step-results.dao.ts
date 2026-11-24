import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InferSelectModel } from 'drizzle-orm';
import { reviewStepResults } from '../db/schema';

export type ReviewStepResult = InferSelectModel<typeof reviewStepResults>;
export type StepOutcome = ReviewStepResult['outcome'];

export interface ReviewStepResultInsert {
  reviewLogId: string;
  stepId: string;
  outcome: StepOutcome;
}

@Injectable()
export class ReviewStepResultsDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async insertMany(
    rows: ReviewStepResultInsert[],
    tx?: NodePgDatabase,
  ): Promise<ReviewStepResult[]> {
    const db = tx ?? this.db;
    if (rows.length === 0) return [];

    return db.insert(reviewStepResults).values(rows).returning();
  }
}
