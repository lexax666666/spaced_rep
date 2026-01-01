import { Test, TestingModule } from '@nestjs/testing';
import { FsrsSchedulerService } from './fsrs-scheduler.service';
import { Card, Grade, Rating, State } from 'ts-fsrs';

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
        last_review: newDate,
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



});
