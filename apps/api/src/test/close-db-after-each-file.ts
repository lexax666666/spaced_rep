import { closeTestDatabase } from './test-helpers';

// Each test file opens its own pool. Close it before the container stops, or
// the dropped connections crash the Jest process after the tests have passed.
afterAll(async () => {
  await closeTestDatabase();
});
