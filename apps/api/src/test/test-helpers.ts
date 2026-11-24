import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

let testPool: Pool | null = null;
let testDb: NodePgDatabase | null = null;

export function getTestDatabase(): NodePgDatabase {
  if (!testDb) {
    const connectionString = process.env.TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'TEST_DATABASE_URL is not set. Make sure globalSetup is configured.',
      );
    }

    testPool = new Pool({ connectionString });
    testDb = drizzle(testPool);
  }

  return testDb;
}

export async function clearAllTables(db: NodePgDatabase) {
  // Disable foreign key checks temporarily
  await db.execute(sql`SET session_replication_role = 'replica';`);

  // Get all table names in the public schema
  const tables = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `);

  // Truncate all tables
  for (const table of tables.rows) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table.tablename}" CASCADE;`));
  }

  // Re-enable foreign key checks
  await db.execute(sql`SET session_replication_role = 'origin';`);
}

export async function closeTestDatabase() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}
