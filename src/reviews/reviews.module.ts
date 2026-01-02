import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { FsrsSchedulerModule } from '../fsrs-scheduler/fsrs-scheduler.module';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [FsrsSchedulerModule, RepositoriesModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
