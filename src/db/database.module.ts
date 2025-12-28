import {
  Module,
  Global,
  Inject,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export const PG_POOL = 'PG_POOL';
export const DRIZZLE_DB = 'DRIZZLE_DB';

@Injectable()
class DbShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    console.log('Closing database connection...');
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
        return new Pool({
          connectionString,
          ssl: true,
          max: 10,
        });
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
