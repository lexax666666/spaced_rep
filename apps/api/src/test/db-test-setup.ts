import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { migrationsFolder } from '@repo/db';

let container: StartedPostgreSqlContainer;
let pool: Pool;

export async function setupTestDatabase() {
  container = await new PostgreSqlContainer('ghcr.io/fboulnois/pg_uuidv7:1.7.0')
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  // Set environment variable for tests
  process.env.TEST_DATABASE_URL = connectionString;

  // Run migrations
  pool = new Pool({ connectionString });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder });

  await pool.end();
}

export async function teardownTestDatabase() {
  if (container) {
    await container.stop();
  }
}

// Export for jest global setup/teardown
export default setupTestDatabase;
