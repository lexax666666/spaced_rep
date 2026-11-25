import path from 'node:path';

/** The folder of SQL migrations. Works from both src/ (tsx) and dist/ (built). */
export const migrationsFolder = path.join(__dirname, '..', 'drizzle');
