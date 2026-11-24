# Test Database Setup with Testcontainers

This directory contains the setup and utilities for running integration tests with a real PostgreSQL database using Testcontainers.

## How It Works

1. **Global Setup** (`db-test-setup.ts`):
   - Runs once before all tests
   - Starts a PostgreSQL container using Testcontainers
   - Runs Drizzle migrations on the test database
   - Sets `TEST_DATABASE_URL` environment variable

2. **Global Teardown** (`db-test-teardown.ts`):
   - Runs once after all tests complete
   - Stops and removes the PostgreSQL container

3. **Test Helpers** (`test-helpers.ts`):
   - `getTestDatabase()`: Get a connection to the test database
   - `clearAllTables()`: Clear all tables between tests (use in `beforeEach`)
   - `closeTestDatabase()`: Close the database connection pool

## Writing Tests

### Basic DAO Test Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourDao } from './your.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('YourDao', () => {
  let dao: YourDao;
  let db: NodePgDatabase;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    // Clear all tables before each test
    await clearAllTables(db);

    // Create testing module with test database
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    dao = module.get<YourDao>(YourDao);
  });

  it('should do something', async () => {
    // Your test here
  });
});
```

### Key Points

- Use `getTestDatabase()` in `beforeAll()` to get the database instance
- Use `clearAllTables(db)` in `beforeEach()` to ensure test isolation
- Each test gets a clean database state
- All tests share the same PostgreSQL container for speed

## Running Tests

```bash
# Run all tests (including DAO tests)
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:cov

# Run only DAO tests
npm test -- decks.dao.spec.ts
```

## Requirements

- Docker must be running (Testcontainers needs Docker to start PostgreSQL)
- Migrations must be generated in `./drizzle` directory

## Troubleshooting

**Error: "Cannot find module './drizzle'"**
- Run `npm run db:generate` to generate migrations

**Error: "Docker not running"**
- Start Docker Desktop or Docker daemon

**Tests timeout**
- First test run may take longer as it pulls the PostgreSQL image
- Subsequent runs use the cached image and are faster

**Database connection errors**
- Check that `TEST_DATABASE_URL` is being set by global setup
- Verify migrations ran successfully
