import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FsrsSchedulerService } from '../fsrs-scheduler/fsrs-scheduler.service';
import { CardsDao } from '../repositories/cards.dao';
import { DecksDao } from '../repositories/decks.dao';
import { ReviewLogsDao } from '../repositories/review-logs.dao';
import { StepsDao } from '../repositories/steps.dao';
import { ReviewStepResultsDao } from '../repositories/review-step-results.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InferSelectModel } from 'drizzle-orm';
import { Card, Grade, Rating, State } from 'ts-fsrs';
import { cards } from '../db/schema';
import { isUuid } from '../common/validation';

type DbCard = InferSelectModel<typeof cards>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly fsrsScheduler: FsrsSchedulerService,
    private readonly cardsDao: CardsDao,
    private readonly decksDao: DecksDao,
    private readonly reviewLogsDao: ReviewLogsDao,
    private readonly stepsDao: StepsDao,
    private readonly reviewStepResultsDao: ReviewStepResultsDao,
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
  ) {}

  /**
   * Rates a card once and reschedules it.
   *
   * `missedStepIds` names the steps the user got wrong. It never changes the
   * schedule: it is only recorded, one result per step, so that a step missed
   * again and again can later be split out, or one always passed be skipped.
   */
  async reviewCard(
    userId: string,
    deckId: string,
    cardId: string,
    rating: Rating,
    reviewedAt: Date = new Date(),
    missedStepIds: string[] = [],
  ) {
    if (!Array.isArray(missedStepIds) || !missedStepIds.every(isUuid)) {
      throw new BadRequestException('missedStepIds must be an array of UUIDs');
    }

    // 1. Fetch deck to get FSRS config
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    await this.db.transaction(async (tx) => {
      // 2. Fetch the card and lock it, so a concurrent edit or review of the
      // same card waits until this one is done.
      const dbCard = await this.cardsDao.getCardByIdForUpdate(
        deckId,
        cardId,
        tx,
      );
      if (!dbCard || dbCard.userId !== userId) {
        throw new NotFoundException('Card not found');
      }

      // Every step of the card gets a result, so the missed ones must be its own.
      const cardSteps = await this.stepsDao.getStepsForCard(cardId, tx);
      const cardStepIds = new Set(cardSteps.map((step) => step.id));
      const missed = new Set(missedStepIds);
      const foreignStepId = [...missed].find((id) => !cardStepIds.has(id));
      if (foreignStepId) {
        throw new BadRequestException(
          `Step ${foreignStepId} does not belong to this card`,
        );
      }

      // 3. Convert DB card to FSRS Card type
      const fsrsCard = this.convertDbCardToFsrsCard(dbCard, reviewedAt);

      // 4. Call FSRS scheduler
      const scheduleResult = this.fsrsScheduler.schedule(
        { requestRetention: deck.fsrsRequestRetention },
        fsrsCard,
        rating as Grade,
        reviewedAt,
      );

      // 5. Update card with new scheduling data
      await this.cardsDao.updateCardScheduling(
        cardId,
        {
          lastReviewedAt: reviewedAt,
          nextReviewAt: scheduleResult.card.due,
          fsrsStability: scheduleResult.card.stability,
          fsrsDifficulty: scheduleResult.card.difficulty,
          fsrsState: this.mapFsrsStateToDb(scheduleResult.card.state),
          fsrsLapses: scheduleResult.card.lapses,
          reviewCount: scheduleResult.card.reps,
          lastRating: this.mapRatingToEnum(rating),
        },
        tx,
      );

      // Insert review log
      const reviewLog = await this.reviewLogsDao.insert(
        {
          cardId,
          userId,
          rating: this.mapRatingToEnum(rating),
          state: this.mapFsrsStateToDb(scheduleResult.log.state),
          dueAt: scheduleResult.log.review,
          stability: scheduleResult.log.stability,
          difficulty: scheduleResult.log.difficulty,
          elapsedDays: scheduleResult.log.elapsed_days,
          lastElapsedDays: scheduleResult.log.last_elapsed_days,
          scheduledDays: scheduleResult.log.scheduled_days,
          learningStep: dbCard.fsrsStep,
          reviewedAt,
        },
        tx,
      );

      // Record how each step went
      await this.reviewStepResultsDao.insertMany(
        cardSteps.map((step) => ({
          reviewLogId: reviewLog.id,
          stepId: step.id,
          outcome: missed.has(step.id) ? 'FAILED' : 'PASSED',
        })),
        tx,
      );
    });

    // Return the updated card
    return this.cardsDao.getCardById(deckId, cardId);
  }

  private convertDbCardToFsrsCard(dbCard: DbCard, reviewedAt: Date): Card {
    // Calculate elapsed days since last review
    const elapsedDays = dbCard.lastReviewedAt
      ? Math.floor(
          (reviewedAt.getTime() - dbCard.lastReviewedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // Calculate scheduled days (from last review to next review)
    const scheduledDays =
      dbCard.lastReviewedAt && dbCard.nextReviewAt
        ? Math.floor(
            (dbCard.nextReviewAt.getTime() - dbCard.lastReviewedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

    return {
      due: dbCard.nextReviewAt ?? reviewedAt,
      stability: dbCard.fsrsStability,
      difficulty: dbCard.fsrsDifficulty,
      elapsed_days: elapsedDays,
      scheduled_days: scheduledDays,
      reps: dbCard.reviewCount,
      lapses: dbCard.fsrsLapses,
      state: this.mapDbStateToFsrs(dbCard.fsrsState),
      last_review: dbCard.lastReviewedAt ?? undefined,
      learning_steps: dbCard.fsrsStep,
    };
  }

  private mapDbStateToFsrs(
    state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING',
  ): State {
    const stateMap: Record<string, State> = {
      NEW: State.New,
      LEARNING: State.Learning,
      REVIEW: State.Review,
      RELEARNING: State.Relearning,
    };
    return stateMap[state];
  }

  private mapFsrsStateToDb(
    state: State,
  ): 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING' {
    const stateMap: Record<
      State,
      'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING'
    > = {
      [State.New]: 'NEW',
      [State.Learning]: 'LEARNING',
      [State.Review]: 'REVIEW',
      [State.Relearning]: 'RELEARNING',
    };
    return stateMap[state];
  }

  private mapRatingToEnum(rating: Rating): 'AGAIN' | 'HARD' | 'GOOD' | 'EASY' {
    const ratingMap: Record<Rating, 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'> = {
      0: 'GOOD', // Manual rating - default to GOOD
      1: 'AGAIN',
      2: 'HARD',
      3: 'GOOD',
      4: 'EASY',
    };
    return ratingMap[rating];
  }
}
