import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module';
import { PG_POOL } from './../src/db/database.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  // Shared state across sequential tests
  let accessToken: string;
  let deckId: string;
  let cardId: string;

  beforeAll(async () => {
    // Set env vars so ConfigService picks them up
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret';

    // Create a non-SSL pool for testcontainer
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Clear all tables in FK-safe order
    await pool.query(`
      TRUNCATE TABLE sides, review_logs, cards, decks, users CASCADE
    `);
  });

  afterAll(async () => {
    await app.close();
    // pool.end() is already called by DbShutdown.onApplicationShutdown()
  });

  // ─── Auth Endpoints ──────────────────────────────────────

  describe('Auth', () => {
    it('POST /auth/register — should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.id).toBeDefined();

      accessToken = res.body.accessToken;
    });

    it('POST /auth/register — should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(409);
    });

    it('POST /auth/login — should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');

      // Use this token for the rest of the tests
      accessToken = res.body.accessToken;
    });

    it('POST /auth/login — should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  // ─── Decks Endpoints ─────────────────────────────────────

  describe('Decks', () => {
    it('POST /decks — should create a deck', async () => {
      const res = await request(app.getHttpServer())
        .post('/decks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Japanese Vocab',
          description: 'Basic vocabulary',
          newCardsPerDay: 20,
          reviewCardsPerDay: 100,
        })
        .expect(201);

      expect(res.body.name).toBe('Japanese Vocab');
      expect(res.body.id).toBeDefined();
      deckId = res.body.id;
    });

    it('GET /decks — should return all decks for the user', async () => {
      const res = await request(app.getHttpServer())
        .get('/decks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Japanese Vocab');
    });

    it('GET /decks/:id — should return a single deck', async () => {
      const res = await request(app.getHttpServer())
        .get(`/decks/${deckId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(deckId);
      expect(res.body.name).toBe('Japanese Vocab');
    });

    it('PATCH /decks/:id — should update the deck', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/decks/${deckId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Japanese Vocab Updated' })
        .expect(200);

      expect(res.body.name).toBe('Japanese Vocab Updated');
    });

    it('DELETE /decks/:id — should delete the deck', async () => {
      // Create a throwaway deck to delete
      const createRes = await request(app.getHttpServer())
        .post('/decks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          newCardsPerDay: 10,
          reviewCardsPerDay: 50,
        })
        .expect(201);

      const deleteId = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/decks/${deleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('GET /decks/:id — should return 404 for deleted deck', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/decks/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── Cards Endpoints ─────────────────────────────────────

  describe('Cards', () => {
    let cardDeckId: string;

    beforeAll(async () => {
      // Create a fresh deck for card tests
      const res = await request(app.getHttpServer())
        .post('/decks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Card Test Deck',
          newCardsPerDay: 20,
          reviewCardsPerDay: 100,
        })
        .expect(201);

      cardDeckId = res.body.id;
    });

    it('POST /decks/:deckId/cards — should create a card with sides', async () => {
      const res = await request(app.getHttpServer())
        .post(`/decks/${cardDeckId}/cards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          templateType: 'VOCAB',
          sides: [
            { type: 'RICH_TEXT', label: 'front', value: { text: 'hello' } },
            { type: 'RICH_TEXT', label: 'back', value: { text: 'こんにちは' } },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.templateType).toBe('VOCAB');
      expect(res.body.sides).toHaveLength(2);
      expect(res.body.sides[0].label).toBe('front');
      expect(res.body.sides[1].label).toBe('back');

      cardId = res.body.id;
    });

    it('GET /decks/:deckId/cards — should list all cards with sides', async () => {
      const res = await request(app.getHttpServer())
        .get(`/decks/${cardDeckId}/cards`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].sides).toHaveLength(2);
    });

    it('GET /decks/:deckId/cards/:id — should return a single card with sides', async () => {
      const res = await request(app.getHttpServer())
        .get(`/decks/${cardDeckId}/cards/${cardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(cardId);
      expect(res.body.sides).toHaveLength(2);
    });

    it('PATCH /decks/:deckId/cards/:id — should replace sides', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/decks/${cardDeckId}/cards/${cardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sides: [
            { type: 'RICH_TEXT', label: 'front', value: { text: 'goodbye' } },
            { type: 'RICH_TEXT', label: 'back', value: { text: 'さようなら' } },
          ],
        })
        .expect(200);

      expect(res.body.sides).toHaveLength(2);
      expect(res.body.sides[0].value).toEqual({ text: 'goodbye' });
    });

    it('DELETE /decks/:deckId/cards/:id — should delete the card', async () => {
      await request(app.getHttpServer())
        .delete(`/decks/${cardDeckId}/cards/${cardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('GET /decks/:deckId/cards/:id — should return 404 for deleted card', async () => {
      await request(app.getHttpServer())
        .get(`/decks/${cardDeckId}/cards/${cardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // ─── Auth Guard Tests ────────────────────────────────────

  describe('Auth Guard', () => {
    it('GET /decks — should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/decks')
        .expect(401);
    });

    it('GET /decks/:deckId/cards — should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/decks/some-id/cards')
        .expect(401);
    });
  });
});
