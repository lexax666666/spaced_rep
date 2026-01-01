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

  it('initial review', () => {
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
  });


});
