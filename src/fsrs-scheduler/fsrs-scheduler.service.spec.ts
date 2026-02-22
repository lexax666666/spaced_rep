import { Test, TestingModule } from '@nestjs/testing';
import { FsrsSchedulerService } from './fsrs-scheduler.service';
import { Card, Grade, Rating, State, createEmptyCard } from 'ts-fsrs';

describe('FsrsSchedulerService', () => {
  let service: FsrsSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FsrsSchedulerService],
    }).compile();

    service = module.get<FsrsSchedulerService>(FsrsSchedulerService);
  });

  describe('initial review', () => {
    it('New + Good', () => {
      const emptyCard: Card = createEmptyCard();
      const config = { requestRetention: 0.9 };
      const grade: Grade = Rating.Good;

      const dateString = '2025-12-31T00:00:00-05:00';
      const newDate = new Date(dateString);

      const card: Card = {
        due: newDate,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined,
        learning_steps: 0,
      };

      const result = service.schedule(config, card, grade, newDate);
      expect(result.card.stability).toEqual(2.3065);
      expect(result.card.difficulty).toEqual(2.11810397);
      expect(result.card.reps).toEqual(1);
      expect(result.card.state).toEqual(State.Learning);
      expect(result.card.learning_steps).toEqual(1);
      expect(result.card.due).toEqual(new Date('2025-12-31T05:10:00.000Z'));
    });

    it('New + Again', () => {
      const config = { requestRetention: 0.9 };
      const grade: Grade = Rating.Again;

      const dateString = '2025-12-31T00:00:00-05:00';
      const newDate = new Date(dateString);

      const card: Card = {
        due: newDate,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: newDate,
        learning_steps: 0,
      };

      const result = service.schedule(config, card, grade, newDate);

      // State should be Learning
      expect(result.card.state).toEqual(State.Learning);
      // due should be later today (still in learning);
      expect(result.card.learning_steps).toEqual(0);
      expect(result.card.reps).toEqual(1);

      // Stability should be very low (less than Good's 2.3065)
      expect(result.card.stability).toEqual(0.212);

      // Due should be soon (same day - scheduled_days should be 0)
      expect(result.card.difficulty).toEqual(6.4133);
      expect(result.card.due).toEqual(new Date('2025-12-31T05:01:00.000Z'));
    });

    it('New + Hard', () => {
      const config = { requestRetention: 0.9 };
      const grade: Grade = Rating.Hard;

      const dateString = '2025-12-31T00:00:00-05:00';
      const newDate = new Date(dateString);

      const card: Card = {
        due: newDate,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: newDate,
        learning_steps: 0,
      };

      const result = service.schedule(config, card, grade, newDate);

      // State should be Learning
      expect(result.card.state).toEqual(State.Learning);
      expect(result.card.learning_steps).toEqual(0);
      expect(result.card.reps).toEqual(1);

      // Stability should be between Again and Good
      expect(result.card.stability).toEqual(1.2931);
      expect(result.card.difficulty).toEqual(5.11217071);
      expect(result.card.due).toEqual(new Date('2025-12-31T05:06:00.000Z'));
    });

    it('New + Easy', () => {
      const config = { requestRetention: 0.9 };
      const grade: Grade = Rating.Easy;

      const dateString = '2025-12-31T00:00:00-05:00';
      const newDate = new Date(dateString);

      const card: Card = {
        due: newDate,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: newDate,
        learning_steps: 0,
      };

      const result = service.schedule(config, card, grade, newDate);

      // May be Learning or Review (depending on FSRS implementation)
      expect(result.card.state).toEqual(State.Review);
      expect(result.card.reps).toEqual(1);

      // Stability should be much higher than Good's 2.3065
      expect(result.card.stability).toEqual(8.2956);

      // Due should be further out than Good (larger scheduled_days)
      expect(result.card.difficulty).toEqual(1);
      expect(result.card.due).toEqual(new Date('2026-01-08T05:00:00.000Z'));
    });
  });

  describe('A. The Engine - Core Memory Parameters', () => {
    const baseDate = new Date('2025-01-01T12:00:00Z');
    const defaultConfig = { requestRetention: 0.9 };

    describe('1. Stability ($S$) Impact', () => {
      it('should schedule the next review much further for High Stability cards', () => {
        // Create two cards identical in every way EXCEPT Stability
        const lowStabilityCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 5, // Weak memory (5 days)
          difficulty: 5,
        };

        const highStabilityCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 50, // Strong memory (50 days)
          difficulty: 5,
        };

        // Review both with "Good" at the same time
        const resultLow = service.schedule(
          defaultConfig,
          lowStabilityCard,
          Rating.Good,
          baseDate,
        );
        const resultHigh = service.schedule(
          defaultConfig,
          highStabilityCard,
          Rating.Good,
          baseDate,
        );

        // IMPACT: High stability must result in a significantly later due date
        // Logic: 50 stability should yield ~45-50 days, 5 stability ~4-5 days
        expect(resultHigh.card.due.getTime()).toBeGreaterThan(
          resultLow.card.due.getTime(),
        );

        // Quantify the gap: High stability interval should be roughly 8-12x larger
        const lowInterval = resultLow.card.scheduled_days;
        const highInterval = resultHigh.card.scheduled_days;
        expect(highInterval).toBeGreaterThan(lowInterval * 5);
      });
    });

    describe('2. Difficulty ($D$) Impact', () => {
      it('should grow stability slower for Difficult cards when rated Good', () => {
        // Two cards: same stability, but one is "Easy" (D=1) and one is "Hard" (D=9)
        const easyCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 10,
          difficulty: 1, // Simple card
        };

        const hardCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 10,
          difficulty: 9, // Complex card
        };

        const resultEasy = service.schedule(
          defaultConfig,
          easyCard,
          Rating.Easy,
          baseDate,
        );
        const resultHard = service.schedule(
          defaultConfig,
          hardCard,
          Rating.Easy,
          baseDate,
        );

        // IMPACT: Easy cards gain MORE stability boost than Hard cards on a "Good" rating
        // Why? Because if you already find it hard, FSRS is conservative about extending the interval.
        expect(resultEasy.card.stability).toBeGreaterThan(
          resultHard.card.stability,
        );
      });

      it('should penalize stability drop faster for Difficult cards when rated Again', () => {
        const easyCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 20,
          difficulty: 2,
        };

        const hardCard: Card = {
          ...createEmptyCard(),
          state: State.Review,
          last_review: baseDate,
          stability: 20,
          difficulty: 9,
        };

        const resultEasy = service.schedule(
          defaultConfig,
          easyCard,
          Rating.Again,
          baseDate,
        );
        const resultHard = service.schedule(
          defaultConfig,
          hardCard,
          Rating.Again,
          baseDate,
        );

        // IMPACT: Failing a hard card is expected, so stability might be preserved slightly more?
        // Actually, FSRS math says: Harder cards drop stability MORE drastically to force review.
        expect(resultEasy.card.stability).toBeGreaterThan(
          resultHard.card.stability,
        );
      });
    });

    describe('3. State Impact', () => {
      it('should ignore Stability math when State is Learning', () => {
        // In Learning, intervals come from "steps", not the stability formula
        const learningCard: Card = {
          ...createEmptyCard(),
          state: State.Learning, // State 1
          stability: 500, // Massive fake stability (should be ignored)
          difficulty: 5,
          learning_steps: 0, // 1st step is usually short (e.g. 1m or 10m)
        };

        const result = service.schedule(
          defaultConfig,
          learningCard,
          Rating.Good,
          baseDate,
        );

        // IMPACT: Even though stability is 500, the due date should be very soon (minutes away)
        // because we are in LEARNING state.
        const diffInMinutes =
          (result.card.due.getTime() - baseDate.getTime()) / 1000 / 60;
        expect(diffInMinutes).toBeLessThan(20); // Should be roughly 1-10 mins

        // Stability should NOT drastically affect the next interval in this phase
        expect(result.card.scheduled_days).toBe(0);
      });
    });
  });

  describe('B. The Time Inputs - Retrievability & Lateness', () => {
    const baseDate = new Date('2025-01-01T00:00:00Z');
    const defaultConfig = { requestRetention: 0.9 };

    it('should reward "Late" reviews with a massive stability boost', () => {
      const initialStability = 10;

      const card: Card = {
        ...createEmptyCard(),
        state: State.Review,
        last_review: baseDate,
        stability: initialStability,
        difficulty: 5,
        due: new Date('2025-01-11T00:00:00Z'), // Due in 10 days
      };

      // Scenario 1: Reviewed ON TIME (10 days later)
      const onTimeDate = new Date('2025-01-11T00:00:00Z');
      const resultOnTime = service.schedule(
        defaultConfig,
        card,
        Rating.Good,
        onTimeDate,
      );

      // Scenario 2: Reviewed LATE (30 days later - 20 days overdue)
      // User waited 3x the interval and STILL got it right!
      const lateDate = new Date('2025-01-31T00:00:00Z');
      const resultLate = service.schedule(
        defaultConfig,
        card,
        Rating.Good,
        lateDate,
      );

      // IMPACT: The user proved their memory is stronger than we thought.
      // The "Late" result should have much higher new stability than the "On Time" result.

      console.log(`On Time Stability: ${resultOnTime.card.stability}`);
      console.log(`Late Stability: ${resultLate.card.stability}`);

      expect(resultLate.card.stability).toBeGreaterThan(
        resultOnTime.card.stability,
      );

      // The boost is often significant (e.g., > 1.5x)
      expect(resultLate.card.stability).toBeGreaterThan(
        resultOnTime.card.stability * 1.2,
      );
    });

    it('should prevent "Cramming" (Early Review) from increasing stability much', () => {
      const card: Card = {
        ...createEmptyCard(),
        state: State.Review,
        last_review: baseDate,
        stability: 10,
        difficulty: 5,
        due: new Date('2025-01-11T00:00:00Z'), // Due in 10 days
      };

      // Scenario: User reviews it 1 hour after last review (Cramming)
      const cramDate = new Date('2025-01-01T01:00:00Z');
      const resultCram = service.schedule(
        defaultConfig,
        card,
        Rating.Good,
        cramDate,
      );

      // IMPACT: Retrievability is near 100%. The brain didn't work hard.
      // Stability should barely increase, or stay exactly the same.
      const stabilityIncrease = resultCram.card.stability - card.stability;

      // Should be very small compared to a normal review
      expect(stabilityIncrease).toBeLessThan(1.0);
    });
  });
});
