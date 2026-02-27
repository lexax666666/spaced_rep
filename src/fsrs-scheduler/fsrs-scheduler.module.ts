import { Module } from '@nestjs/common';
import { FsrsSchedulerService } from './fsrs-scheduler.service';

@Module({
  providers: [FsrsSchedulerService],
  exports: [FsrsSchedulerService],
})
export class FsrsSchedulerModule {}
