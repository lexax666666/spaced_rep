import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  InferSelectModel,
  and,
  asc,
  eq,
  inArray,
  notInArray,
} from 'drizzle-orm';
import { steps, StepType } from '../db/schema';

export type Step = InferSelectModel<typeof steps>;

export interface StepContent {
  type: StepType;
  label: string;
  value: Record<string, unknown>;
  customStepTypeVersionId?: string | null;
}

export interface InsertStepInput extends StepContent {
  cardId: string;
  position: number;
}

// A step with an id is updated in place; one without is created.
export interface SyncStepInput extends StepContent {
  id?: string;
}

// Positions are 1-based.
const positionForIndex = (index: number): number => index + 1;

@Injectable()
export class StepsDao {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async insertSteps(
    data: InsertStepInput[],
    tx?: NodePgDatabase,
  ): Promise<Step[]> {
    const db = tx ?? this.db;
    if (data.length === 0) return [];

    return db.insert(steps).values(data).returning();
  }

  /** Inserts steps for a card in the order given. */
  async insertStepsInOrder(
    cardId: string,
    data: StepContent[],
    tx?: NodePgDatabase,
  ): Promise<Step[]> {
    return this.insertSteps(
      data.map((step, index) => ({
        ...step,
        cardId,
        position: positionForIndex(index),
      })),
      tx,
    );
  }

  async getStepsForCard(cardId: string, tx?: NodePgDatabase): Promise<Step[]> {
    const db = tx ?? this.db;
    return db
      .select()
      .from(steps)
      .where(eq(steps.cardId, cardId))
      .orderBy(asc(steps.position));
  }

  async getStepsForCards(cardIds: string[]): Promise<Step[]> {
    if (cardIds.length === 0) return [];

    return this.db
      .select()
      .from(steps)
      .where(inArray(steps.cardId, cardIds))
      .orderBy(asc(steps.cardId), asc(steps.position));
  }

  /**
   * Makes a card's steps match `desired`, in that order.
   *
   * Steps that carry an id keep it, so review history that points at them
   * survives an edit. Steps missing from `desired` are deleted. Throws if an
   * id is not one of the card's steps; callers should lock the card row first
   * so its steps cannot change underneath them.
   *
   * Runs in a transaction because the (card_id, position) uniqueness is only
   * checked at commit, which is what lets steps swap places.
   */
  async syncSteps(
    cardId: string,
    desired: SyncStepInput[],
    tx?: NodePgDatabase,
  ): Promise<Step[]> {
    if (!tx) {
      return this.db.transaction((newTx) =>
        this.syncSteps(cardId, desired, newTx),
      );
    }

    const keptIds = desired.flatMap((step) => (step.id ? [step.id] : []));

    await tx
      .delete(steps)
      .where(
        keptIds.length > 0
          ? and(eq(steps.cardId, cardId), notInArray(steps.id, keptIds))
          : eq(steps.cardId, cardId),
      );

    const now = new Date();
    const toInsert: InsertStepInput[] = [];

    for (const [index, step] of desired.entries()) {
      const { id, ...content } = step;
      const position = positionForIndex(index);

      if (!id) {
        toInsert.push({ ...content, cardId, position });
        continue;
      }

      const updated = await tx
        .update(steps)
        .set({
          type: content.type,
          label: content.label,
          value: content.value,
          customStepTypeVersionId: content.customStepTypeVersionId ?? null,
          position,
          updatedAt: now,
        })
        .where(and(eq(steps.id, id), eq(steps.cardId, cardId)))
        .returning({ id: steps.id });

      if (updated.length === 0) {
        throw new Error(`Step ${id} is not a step of card ${cardId}`);
      }
    }

    await this.insertSteps(toInsert, tx);

    return this.getStepsForCard(cardId, tx);
  }
}
