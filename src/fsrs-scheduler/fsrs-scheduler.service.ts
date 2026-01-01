import { Injectable } from '@nestjs/common';
import { FSRS, Card, Grade, RecordLogItem } from 'ts-fsrs';

export interface FsrsScheduleConfig {
  requestRetention: number;
}

@Injectable()
export class FsrsSchedulerService {
  private makeFsrs(requestRetention: number) {
    return new FSRS({ request_retention: requestRetention });
  }

  schedule(
    config: FsrsScheduleConfig,
    card: Card,
    grade: Grade,
    now: Date = new Date(),
  ): RecordLogItem {
    const fsrs = this.makeFsrs(config.requestRetention);
    const resultByGrade = fsrs.repeat(card, now);
    return resultByGrade[grade];
  }
}
