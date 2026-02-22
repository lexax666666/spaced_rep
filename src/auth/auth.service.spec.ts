import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersDao } from '../repositories/users.dao';
import { DRIZZLE_DB } from '../db/database.module';
import { getTestDatabase, clearAllTables } from '../test/test-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let db: NodePgDatabase;

  beforeAll(() => {
    db = getTestDatabase();
  });

  beforeEach(async () => {
    // Clear all tables before each test
    await clearAllTables(db);

    // Create testing module with all dependencies
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        AuthService,
        UsersDao,
        {
          provide: DRIZZLE_DB,
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should create user and return accessToken + user', async () => {
      const result = await service.register({
        email: 'newuser@example.com',
        password: 'securePassword123',
        name: 'New User',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.name).toBe('New User');
    });

    it('returned token should be a valid JWT with correct sub and email', async () => {
      const result = await service.register({
        email: 'jwttest@example.com',
        password: 'securePassword123',
      });

      const decoded = jwtService.verify(result.accessToken);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(result.user.id);
      expect(decoded.email).toBe('jwttest@example.com');
      expect(decoded.exp).toBeDefined();
    });

    it('should hash the password (not store plaintext)', async () => {
      const plainPassword = 'myPlainPassword456';

      await service.register({
        email: 'hashcheck@example.com',
        password: plainPassword,
      });

      // Query the DB directly to verify the stored password hash
      const dbResult = await db
        .select()
        .from(users)
        .where(eq(users.email, 'hashcheck@example.com'))
        .limit(1);

      expect(dbResult).toHaveLength(1);
      expect(dbResult[0].passwordHash).not.toBe(plainPassword);
      expect(dbResult[0].passwordHash).toBeDefined();

      // Verify the hash is a valid bcrypt hash that matches the original password
      const isMatch = await bcrypt.compare(
        plainPassword,
        dbResult[0].passwordHash!,
      );
      expect(isMatch).toBe(true);
    });

    it('should throw ConflictException for duplicate email', async () => {
      await service.register({
        email: 'duplicate@example.com',
        password: 'password123',
      });

      await expect(
        service.register({
          email: 'duplicate@example.com',
          password: 'differentPassword456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return accessToken for valid credentials', async () => {
      // First register a user
      const registered = await service.register({
        email: 'login@example.com',
        password: 'loginPassword123',
        name: 'Login User',
      });

      // Then login with the same credentials
      const result = await service.login({
        email: 'login@example.com',
        password: 'loginPassword123',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.user.id).toBe(registered.user.id);
      expect(result.user.email).toBe('login@example.com');
      expect(result.user.name).toBe('Login User');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // First register a user
      await service.register({
        email: 'wrongpass@example.com',
        password: 'correctPassword123',
      });

      // Then login with wrong password
      await expect(
        service.login({
          email: 'wrongpass@example.com',
          password: 'wrongPassword456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      await expect(
        service.login({
          email: 'nobody@example.com',
          password: 'anyPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
