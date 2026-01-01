import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

let container: StartedPostgreSqlContainer;
let pool: Pool;

export async function setupTestDatabase() {
  console.log('Starting PostgreSQL container...');

  const container = await new PostgreSqlContainer(
    'ghcr.io/fboulnois/pg_uuidv7:1.7.0',
  )
    .withExposedPorts(5432)
    .start();

  const connectionString = container.getConnectionUri();

  console.log('PostgreSQL container started');
  console.log('Connection string:', connectionString);

  // Set environment variable for tests
  process.env.TEST_DATABASE_URL = connectionString;

  // Run migrations
  pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('connection string for migrations:', connectionString);
  console.log('Running migrations on test database...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed');

  await pool.end();
}

export async function teardownTestDatabase() {
  console.log('Stopping PostgreSQL container...');

  if (container) {
    await container.stop();
    console.log('PostgreSQL container stopped');
  }
}

// Export for jest global setup/teardown
export default setupTestDatabase;
