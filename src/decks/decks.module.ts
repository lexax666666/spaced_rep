import { Module } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RepositoriesModule, AuthModule],
  providers: [DecksService],
  controllers: [DecksController],
})
export class DecksModule {}
