import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { CardsDao } from './cards.dao';
import { DecksDao } from './decks.dao';
import { ReviewLogsDao } from './review-logs.dao';

@Module({
  imports: [DatabaseModule],
  providers: [CardsDao, DecksDao, ReviewLogsDao],
  exports: [CardsDao, DecksDao, ReviewLogsDao],
})
export class RepositoriesModule {}
