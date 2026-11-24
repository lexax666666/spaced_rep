/** Apply pending migrations. Run once per deploy, before any app starts: pnpm --filter @repo/db migrate */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { migrationsFolder } from './migrations-folder';

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    process.stdout.write('migrations applied\n');
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
