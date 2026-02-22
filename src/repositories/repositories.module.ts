import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { CardsDao } from './cards.dao';
import { DecksDao } from './decks.dao';
import { ReviewLogsDao } from './review-logs.dao';
import { UsersDao } from './users.dao';

@Module({
  imports: [DatabaseModule],
  providers: [CardsDao, DecksDao, ReviewLogsDao, UsersDao],
  exports: [CardsDao, DecksDao, ReviewLogsDao, UsersDao],
})
export class RepositoriesModule {}
