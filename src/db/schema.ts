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
  lastReviewedAt: timestamp('last_reviewed_at'),
  nextReviewAt: timestamp('next_review_at'),
  intervalDays: integer('interval_days').notNull().default(0),
  easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
  reviewCount: integer('review_count').notNull().default(0),
  lastRating: reviewRatingEnum('last_rating'),
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
