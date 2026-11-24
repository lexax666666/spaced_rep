import { Test, TestingModule } from '@nestjs/testing';
import { UsersDao } from './users.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('UsersDao', () => {
  let dao: UsersDao;
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
        UsersDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    dao = module.get<UsersDao>(UsersDao);
  });

  describe('create', () => {
    it('should create a user with email and passwordHash', async () => {
      const result = await dao.create({
        email: 'test@example.com',
        passwordHash: 'hashed-password-123',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.passwordHash).toBe('hashed-password-123');
      expect(result.name).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a user with optional name', async () => {
      const result = await dao.create({
        email: 'named@example.com',
        passwordHash: 'hashed-password-456',
        name: 'Test User',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe('named@example.com');
      expect(result.passwordHash).toBe('hashed-password-456');
      expect(result.name).toBe('Test User');
    });

    it('should throw on duplicate email (unique constraint)', async () => {
      await dao.create({
        email: 'duplicate@example.com',
        passwordHash: 'hashed-password-aaa',
      });

      await expect(
        dao.create({
          email: 'duplicate@example.com',
          passwordHash: 'hashed-password-bbb',
        }),
      ).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const created = await dao.create({
        email: 'findme@example.com',
        passwordHash: 'hashed-password-789',
        name: 'Find Me',
      });

      const result = await dao.findByEmail('findme@example.com');

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
      expect(result?.email).toBe('findme@example.com');
      expect(result?.name).toBe('Find Me');
    });

    it('should return null when email does not exist', async () => {
      const result = await dao.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when id exists', async () => {
      const created = await dao.create({
        email: 'byid@example.com',
        passwordHash: 'hashed-password-abc',
        name: 'By ID',
      });

      const result = await dao.findById(created.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
      expect(result?.email).toBe('byid@example.com');
      expect(result?.name).toBe('By ID');
    });

    it('should return null when id does not exist', async () => {
      const result = await dao.findById(
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });
  });
});
