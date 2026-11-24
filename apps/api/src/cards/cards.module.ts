import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RepositoriesModule, AuthModule],
  providers: [CardsService],
  controllers: [CardsController],
})
export class CardsModule {}
