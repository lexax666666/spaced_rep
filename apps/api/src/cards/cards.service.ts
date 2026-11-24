import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InferSelectModel } from 'drizzle-orm';
import { cards } from '../db/schema';
import { CardsDao } from '../repositories/cards.dao';
import { Step, StepsDao } from '../repositories/steps.dao';
import { DecksDao } from '../repositories/decks.dao';
import { CardTemplatesDao } from '../repositories/card-templates.dao';
import {
  CreateCardDto,
  UpdateCardDto,
  createCardSchema,
  updateCardSchema,
} from './cards.dto';
import { parseWith } from '../common/validation';

type Card = InferSelectModel<typeof cards>;
export type CardWithSteps = Card & { steps: Step[] };

@Injectable()
export class CardsService {
  constructor(
    private readonly cardsDao: CardsDao,
    private readonly stepsDao: StepsDao,
    private readonly decksDao: DecksDao,
    private readonly cardTemplatesDao: CardTemplatesDao,
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
  ) {}

  async create(
    userId: string,
    deckId: string,
    // Undefined when the request has no body.
    dto: CreateCardDto | undefined,
  ): Promise<CardWithSteps> {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    // A request without a body is treated as an empty card.
    const input = parseWith(createCardSchema, dto ?? {});
    const stepInputs = input.steps;
    if (stepInputs.some((step) => step.id)) {
      throw new BadRequestException('steps must not carry an id on create');
    }
    // The template is only recorded. The client copies its step definitions
    // into `steps`, so a card can start from a template and then diverge.
    const templateId = await this.resolveTemplateId(userId, input.templateId);

    return this.db.transaction(async (tx) => {
      // Hold the deck so it cannot be deleted between the check and the insert.
      const liveDeck = await this.decksDao.getDeckForUserForShare(
        userId,
        deckId,
        tx,
      );
      if (!liveDeck) {
        throw new NotFoundException('Deck not found');
      }

      const card = await this.cardsDao.insertCard(
        { userId, deckId, templateId },
        tx,
      );
      const cardSteps = await this.stepsDao.insertStepsInOrder(
        card.id,
        stepInputs,
        tx,
      );

      return { ...card, steps: cardSteps };
    });
  }

  async findAll(userId: string, deckId: string): Promise<CardWithSteps[]> {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const cardsList = await this.cardsDao.getCardsByDeckId(deckId, userId);
    const allSteps = await this.stepsDao.getStepsForCards(
      cardsList.map((card) => card.id),
    );

    // Steps arrive ordered by position, so each group stays in order.
    const stepsByCardId = new Map<string, Step[]>();
    for (const step of allSteps) {
      stepsByCardId.set(step.cardId, [
        ...(stepsByCardId.get(step.cardId) ?? []),
        step,
      ]);
    }

    return cardsList.map((card) => ({
      ...card,
      steps: stepsByCardId.get(card.id) ?? [],
    }));
  }

  async findOne(
    userId: string,
    deckId: string,
    cardId: string,
  ): Promise<CardWithSteps> {
    const card = await this.getOwnedCard(userId, deckId, cardId);
    const cardSteps = await this.stepsDao.getStepsForCard(cardId);

    return { ...card, steps: cardSteps };
  }

  async update(
    userId: string,
    deckId: string,
    cardId: string,
    dto: UpdateCardDto | undefined,
  ): Promise<CardWithSteps> {
    const stepInputs = parseWith(updateCardSchema, dto).steps;

    return this.db.transaction(async (tx) => {
      // Lock the card so a concurrent edit or review cannot interleave.
      const card = await this.cardsDao.getCardByIdForUpdate(deckId, cardId, tx);
      if (!card || card.userId !== userId) {
        throw new NotFoundException('Card not found');
      }

      const existingIds = new Set(
        (await this.stepsDao.getStepsForCard(cardId, tx)).map(
          (step) => step.id,
        ),
      );
      const foreignStep = stepInputs.find(
        (step) => step.id && !existingIds.has(step.id),
      );
      if (foreignStep) {
        throw new BadRequestException(
          `Step ${foreignStep.id} does not belong to this card`,
        );
      }

      const cardSteps = await this.stepsDao.syncSteps(cardId, stepInputs, tx);

      return { ...card, steps: cardSteps };
    });
  }

  async remove(userId: string, deckId: string, cardId: string): Promise<void> {
    await this.getOwnedCard(userId, deckId, cardId);

    // Soft delete: the card is hidden, but it, its steps and its review
    // history stay in the database so it can be restored.
    const deleted = await this.cardsDao.softDeleteCard(deckId, cardId);
    if (!deleted) {
      // Lost a race with another delete of the same card.
      throw new NotFoundException('Card not found');
    }
  }

  private async getOwnedCard(
    userId: string,
    deckId: string,
    cardId: string,
  ): Promise<Card> {
    const card = await this.cardsDao.getCardById(deckId, cardId);
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found');
    }

    return card;
  }

  private async resolveTemplateId(
    userId: string,
    templateId: string | null | undefined,
  ): Promise<string | null> {
    if (!templateId) {
      return null;
    }

    const template = await this.cardTemplatesDao.getTemplateForUser(
      userId,
      templateId,
    );
    if (!template) {
      throw new NotFoundException('Card template not found');
    }

    return template.id;
  }
}
