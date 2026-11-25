import { Module } from '@nestjs/common';
import { CardTemplatesService } from './card-templates.service';
import { CardTemplatesController } from './card-templates.controller';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RepositoriesModule, AuthModule],
  providers: [CardTemplatesService],
  controllers: [CardTemplatesController],
})
export class CardTemplatesModule {}
