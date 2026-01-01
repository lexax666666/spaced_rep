import { Module } from '@nestjs/common';
import { FsrsSchedulerController } from './fsrs-scheduler.controller';
import { FsrsSchedulerService } from './fsrs-scheduler.service';

@Module({
  controllers: [FsrsSchedulerController],
  providers: [FsrsSchedulerService],
  exports: [FsrsSchedulerService],
})
export class FsrsSchedulerModule {}
