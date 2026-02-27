import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { CardsDao } from './cards.dao';
import { DecksDao } from './decks.dao';
import { ReviewLogsDao } from './review-logs.dao';
import { UsersDao } from './users.dao';
import { SidesDao } from './sides.dao';

@Module({
  imports: [DatabaseModule],
  providers: [CardsDao, DecksDao, ReviewLogsDao, UsersDao, SidesDao],
  exports: [CardsDao, DecksDao, ReviewLogsDao, UsersDao, SidesDao],
})
export class RepositoriesModule {}
