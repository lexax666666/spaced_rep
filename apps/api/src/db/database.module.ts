import {
  Module,
  Global,
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export const PG_POOL = 'PG_POOL';
export const DRIZZLE_DB = 'DRIZZLE_DB';

const logger = new Logger('DatabaseModule');

@Injectable()
class DbShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        const pool = new Pool({
          connectionString,
          ssl: true,
          max: 10,
        });
        // An idle connection the server closes (Neon suspends when unused)
        // emits 'error' on the pool. Without a listener that crashes the process.
        pool.on('error', (error) => {
          logger.error(`Idle database connection failed: ${error.message}`);
        });
        return pool;
      },
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE_DB,
      useFactory: (pool: Pool) => drizzle({ client: pool }),
      inject: [PG_POOL],
    },
    DbShutdown,
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
