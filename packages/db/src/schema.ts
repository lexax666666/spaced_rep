import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uuid,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  index,
  unique,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Every timestamp is stored with a time zone.
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const quotedList = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

// Step types are text + CHECK rather than an enum because the list keeps growing.
export const STEP_TYPES = [
  'RICH_TEXT',
  'VIDEO',
  'AUDIO',
  'CHESS_POSITION',
  'ANIMATION',
  'CUSTOM',
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const CUSTOM_STEP_TYPE: StepType = 'CUSTOM';

// Upper bound, in characters, for each of a custom step version's html, css and js.
export const MAX_STEP_CODE_LENGTH = 100_000;

// Enums
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

export const stepOutcomeEnum = pgEnum('step_outcome', [
  'PASSED',
  'FAILED',
  'SKIPPED',
]);

// Tables
export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuid_generate_v7()`),
  name: text('name'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const decks = pgTable(
  'decks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    userId: uuid('user_id')
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
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
    // Soft delete: set when the deck is deleted. Its cards get the same value.
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [index('decks_user_id_idx').on(table.userId)],
);

// A saved recipe for a card. Built-in templates have no owner.
export const cardTemplates = pgTable(
  'card_templates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    userId: uuid('user_id').references(() => users.id),
    name: text('name').notNull(),
    // Ordered list of the steps a new card starts with.
    stepDefinitions: jsonb('step_definitions')
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('card_templates_user_id_idx').on(table.userId),
    check(
      'card_templates_step_definitions_is_array',
      sql`jsonb_typeof(${table.stepDefinitions}) = 'array'`,
    ),
  ],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id),
    // Empty when the card was built by hand rather than from a template.
    templateId: uuid('template_id').references(() => cardTemplates.id),

    // Shared scheduling timestamps (used by BOTH schedulers)
    lastReviewedAt: timestamptz('last_reviewed_at'),
    nextReviewAt: timestamptz('next_review_at'),

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
    scheduler: schedulerTypeEnum('scheduler').notNull().default('FSRS'),

    // Optional analytics (lifetime count)
    reviewCount: integer('review_count').notNull().default(0),

    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
    // Soft delete: set when the card is deleted. The row, its steps and its
    // review history stay, so the card can be restored.
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    // Foreign key index. Covers every row, deleted ones included, so that
    // removing a deck for good can find its cards.
    index('cards_deck_id_idx').on(table.deckId),
    // Serves "due cards in this deck" and deck listings. Partial: soft-deleted
    // cards are never read by those queries, so they are left out of the index.
    index('cards_live_deck_id_next_review_at_idx')
      .on(table.deckId, table.nextReviewAt)
      .where(sql`${table.deletedAt} is null`),
    index('cards_user_id_idx').on(table.userId),
    index('cards_template_id_idx').on(table.templateId),
  ],
);

// The identity of a custom step: who owns it and what it is for.
// Its code lives in custom_step_type_versions; the current version is the highest one.
export const customStepTypes = pgTable(
  'custom_step_types',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [index('custom_step_types_user_id_idx').on(table.userId)],
);

// One saved copy of a custom step's code. Rows are never edited: a change is a new row.
export const customStepTypeVersions = pgTable(
  'custom_step_type_versions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    stepTypeId: uuid('step_type_id')
      .notNull()
      .references(() => customStepTypes.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    html: text('html').notNull().default(''),
    css: text('css').notNull().default(''),
    js: text('js').notNull().default(''),
    // JSON Schema describing the data each step must supply in steps.value.
    fieldSchema: jsonb('field_schema')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('custom_step_type_versions_step_type_id_version_unique').on(
      table.stepTypeId,
      table.version,
    ),
    check(
      'custom_step_type_versions_version_positive',
      sql`${table.version} >= 1`,
    ),
    check(
      'custom_step_type_versions_html_length',
      sql`length(${table.html}) <= ${sql.raw(String(MAX_STEP_CODE_LENGTH))}`,
    ),
    check(
      'custom_step_type_versions_css_length',
      sql`length(${table.css}) <= ${sql.raw(String(MAX_STEP_CODE_LENGTH))}`,
    ),
    check(
      'custom_step_type_versions_js_length',
      sql`length(${table.js}) <= ${sql.raw(String(MAX_STEP_CODE_LENGTH))}`,
    ),
    check(
      'custom_step_type_versions_field_schema_is_object',
      sql`jsonb_typeof(${table.fieldSchema}) = 'object'`,
    ),
  ],
);

// The ordered parts of a card (formerly "sides").
export const steps = pgTable(
  'steps',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    // 1-based order within the card.
    position: integer('position').notNull(),
    type: text('type').$type<StepType>().notNull(),
    // Set only for CUSTOM steps: the exact version of the code that renders the step.
    customStepTypeVersionId: uuid('custom_step_type_version_id'),
    label: text('label').notNull(),
    value: jsonb('value').notNull(),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // The migration declares this DEFERRABLE INITIALLY DEFERRED so that steps
    // can swap positions inside one transaction. Drizzle cannot express that.
    unique('steps_card_id_position_unique').on(table.cardId, table.position),
    // Named explicitly: the generated name exceeds Postgres's 63-character limit.
    // A version that any step uses cannot be deleted.
    foreignKey({
      name: 'steps_custom_step_type_version_id_fk',
      columns: [table.customStepTypeVersionId],
      foreignColumns: [customStepTypeVersions.id],
    }).onDelete('restrict'),
    index('steps_custom_step_type_version_id_idx')
      .on(table.customStepTypeVersionId)
      .where(sql`${table.customStepTypeVersionId} is not null`),
    check('steps_position_positive', sql`${table.position} >= 1`),
    check(
      'steps_type_valid',
      sql`${table.type} in (${quotedList(STEP_TYPES)})`,
    ),
    check(
      'steps_custom_version_matches_type',
      sql`(${table.type} = 'CUSTOM') = (${table.customStepTypeVersionId} is not null)`,
    ),
    check(
      'steps_value_is_object',
      sql`jsonb_typeof(${table.value}) = 'object'`,
    ),
  ],
);

export const reviewLogs = pgTable(
  'review_logs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    // Review action
    rating: reviewRatingEnum('rating').notNull(),
    state: fsrsStateEnum('state').notNull(),

    // Card state before review
    dueAt: timestamptz('due_at').notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),

    // Time tracking
    elapsedDays: integer('elapsed_days').notNull(),
    lastElapsedDays: integer('last_elapsed_days').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),

    // Learning step
    learningStep: integer('learning_step').notNull(),

    // When this review happened
    reviewedAt: timestamptz('reviewed_at').notNull(),

    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('review_logs_card_id_idx').on(table.cardId),
    index('review_logs_user_id_idx').on(table.userId),
  ],
);

// How each step went in one review. Never affects scheduling.
export const reviewStepResults = pgTable(
  'review_step_results',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v7()`),
    reviewLogId: uuid('review_log_id')
      .notNull()
      .references(() => reviewLogs.id, { onDelete: 'cascade' }),
    stepId: uuid('step_id')
      .notNull()
      .references(() => steps.id, { onDelete: 'cascade' }),
    // SKIPPED means the step was not shown, so it must not count as a pass.
    outcome: stepOutcomeEnum('outcome').notNull(),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('review_step_results_review_log_id_step_id_unique').on(
      table.reviewLogId,
      table.stepId,
    ),
    index('review_step_results_step_id_created_at_idx').on(
      table.stepId,
      table.createdAt,
    ),
  ],
);
