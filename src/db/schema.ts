import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
  uuid,
  integer,
  doublePrecision,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// Enums
export const sideTypeEnum = pgEnum('side_type', [
  'RICH_TEXT',
  'VIDEO',
  'AUDIO',
  'CHESS_POSITION',
]);

export const cardTemplateTypeEnum = pgEnum('card_template_type', [
  'VOCAB',
  'CHESS',
  'STANDARD_FLASH_CARD',
  'CUSTOM',
]);

export const reviewRatingEnum = pgEnum('review_rating', [
  'AGAIN',
  'HARD',
  'GOOD',
  'EASY',
]);

export const schedulerTypeEnum = pgEnum('scheduler_type', ['SM2', 'FSRS']);

export const fsrsStateEnum = pgEnum('fsrs_state', [
  'NEW',
  'LEARNING',
  'REVIEW',
  'RELEARNING',
]);

// Tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const decks = pgTable('decks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  newCardsPerDay: integer('new_cards_per_day').notNull(),
  reviewCardsPerDay: integer('review_cards_per_day').notNull(),
  suspendNewCards: boolean('suspend_new_cards').notNull().default(false),
  fsrsRequestRetention: doublePrecision('fsrs_request_retention')
    .notNull()
    .default(0.9),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id),
  templateType: cardTemplateTypeEnum('template_type').notNull(),

  // Shared scheduling timestamps (used by BOTH schedulers)
  lastReviewedAt: timestamp('last_reviewed_at'),
  nextReviewAt: timestamp('next_review_at'),

  // -----------------------
  // SM-2 scheduling state
  // -----------------------
  intervalDays: integer('interval_days').notNull().default(0), // I
  easeFactor: doublePrecision('ease_factor').notNull().default(2.5), // EF
  repetition: integer('repetition').notNull().default(0), // n (consecutive successes)
  quality: integer('quality'), // q (0..5)
  // Keep for UI convenience (maps to quality)
  lastRating: reviewRatingEnum('last_rating'),

  // -----------------------
  // FSRS scheduling state
  // -----------------------
  fsrsStability: doublePrecision('fsrs_stability').notNull().default(0), // S (days); 0 = uninitialized/new
  fsrsDifficulty: doublePrecision('fsrs_difficulty').notNull().default(0), // D; 0 = uninitialized/new
  fsrsState: fsrsStateEnum('fsrs_state').notNull().default('NEW'), // card learning state
  fsrsStep: integer('fsrs_step').notNull().default(0), // current step index in (re)learning
  fsrsLapses: integer('fsrs_lapses').notNull().default(0), // times forgotten/failed

  // Optional: track which scheduler last wrote nextReviewAt for debugging/migration
  scheduler: schedulerTypeEnum('scheduler').notNull().default('SM2'),

  // Optional analytics (lifetime count)
  reviewCount: integer('review_count').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sides = pgTable('sides', {
  id: serial('id').primaryKey(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id),
  type: sideTypeEnum('type').notNull(),
  label: text('label').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reviewLogs = pgTable('review_logs', {
  id: serial('id').primaryKey(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  // Review action
  rating: reviewRatingEnum('rating').notNull(),
  state: fsrsStateEnum('state').notNull(),

  // Card state before review
  dueAt: timestamp('due_at').notNull(),
  stability: doublePrecision('stability').notNull(),
  difficulty: doublePrecision('difficulty').notNull(),

  // Time tracking
  elapsedDays: integer('elapsed_days').notNull(),
  lastElapsedDays: integer('last_elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),

  // Learning step
  learningStep: integer('learning_step').notNull(),

  // When this review happened
  reviewedAt: timestamp('reviewed_at').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
