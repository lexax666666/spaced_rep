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
import { CreateCardDto, UpdateCardDto } from './cards.dto';
import { isUuid } from '../common/validation';
import { parseSteps } from './steps.validation';

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
    dto: CreateCardDto,
  ): Promise<CardWithSteps> {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const stepInputs = parseSteps(dto.steps ?? []);
    if (stepInputs.some((step) => step.id)) {
      throw new BadRequestException('steps must not carry an id on create');
    }
    // The template is only recorded. The client copies its step definitions
    // into `steps`, so a card can start from a template and then diverge.
    const templateId = await this.resolveTemplateId(userId, dto.templateId);

    return this.db.transaction(async (tx) => {
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
    dto: UpdateCardDto,
  ): Promise<CardWithSteps> {
    const stepInputs = parseSteps(dto.steps);

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

    // The card's steps are removed by the foreign key's ON DELETE CASCADE.
    await this.cardsDao.deleteCard(deckId, cardId);
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
    templateId: unknown,
  ): Promise<string | null> {
    if (templateId === undefined || templateId === null) {
      return null;
    }
    if (!isUuid(templateId)) {
      throw new BadRequestException('templateId must be a UUID');
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
