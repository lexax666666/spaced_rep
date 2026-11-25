import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { FsrsSchedulerModule } from './fsrs-scheduler/fsrs-scheduler.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuthModule } from './auth/auth.module';
import { DecksModule } from './decks/decks.module';
import { CardsModule } from './cards/cards.module';
import { CardTemplatesModule } from './card-templates/card-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    FsrsSchedulerModule,
    ReviewsModule,
    AuthModule,
    DecksModule,
    CardsModule,
    CardTemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
