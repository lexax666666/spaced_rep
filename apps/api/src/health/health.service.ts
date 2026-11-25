import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class HealthService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: NodePgDatabase) {}

  async check() {
    try {
      const started = Date.now();
      await this.db.execute('select 1');
      const latencyMs = Date.now() - started;

      return {
        status: 'ok',
        db: 'ok',
        dbLatencyMs: latencyMs,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      });
    }
  }
}
