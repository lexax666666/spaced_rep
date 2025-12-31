import { Injectable } from '@nestjs/common';
import { FSRS, Card, Grade, RecordLogItem } from 'ts-fsrs';

export interface FsrsScheduleConfig {
  requestRetention: number;
}

@Injectable()
export class FsrsSchedulerService {
  schedule(
    config: FsrsScheduleConfig,
    card: Card,
    grade: Grade,
  ): RecordLogItem {
    const fsrs = new FSRS({
      request_retention: config.requestRetention,
    });

    const now = new Date();
    return fsrs.repeat(card, now)[grade];
  }
}
