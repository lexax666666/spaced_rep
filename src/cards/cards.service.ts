import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB } from '../db/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CardsDao } from '../repositories/cards.dao';
import { SidesDao } from '../repositories/sides.dao';
import { DecksDao } from '../repositories/decks.dao';
import { CreateCardDto, UpdateCardDto } from './cards.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly cardsDao: CardsDao,
    private readonly sidesDao: SidesDao,
    private readonly decksDao: DecksDao,
    @Inject(DRIZZLE_DB) private readonly db: NodePgDatabase,
  ) {}

  async create(userId: string, deckId: string, dto: CreateCardDto) {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    let card: any;
    let cardSides: any[] = [];

    await this.db.transaction(async (tx) => {
      card = await this.cardsDao.insertCard(
        { userId, deckId, templateType: dto.templateType },
        tx,
      );

      if (dto.sides && dto.sides.length > 0) {
        cardSides = await this.sidesDao.insertSides(
          dto.sides.map((s) => ({ ...s, cardId: card.id })),
          tx,
        );
      }
    });

    return { ...card, sides: cardSides };
  }

  async findAll(userId: string, deckId: string) {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    const cardsList = await this.cardsDao.getCardsByDeckId(deckId, userId);

    if (cardsList.length === 0) {
      return [];
    }

    const cardIds = cardsList.map((c) => c.id);
    const allSides = await this.sidesDao.getSidesForCards(cardIds);

    const sidesByCardId = new Map<string, typeof allSides>();
    for (const side of allSides) {
      const existing = sidesByCardId.get(side.cardId) ?? [];
      existing.push(side);
      sidesByCardId.set(side.cardId, existing);
    }

    return cardsList.map((card) => ({
      ...card,
      sides: sidesByCardId.get(card.id) ?? [],
    }));
  }

  async findOne(userId: string, deckId: string, cardId: string) {
    const card = await this.cardsDao.getCardById(deckId, cardId);
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found');
    }

    const cardSides = await this.sidesDao.getSidesForCard(cardId);

    return { ...card, sides: cardSides };
  }

  async update(userId: string, deckId: string, cardId: string, dto: UpdateCardDto) {
    const card = await this.cardsDao.getCardById(deckId, cardId);
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found');
    }

    let newSides: any[] = [];

    await this.db.transaction(async (tx) => {
      newSides = await this.sidesDao.replaceSides(cardId, dto.sides, tx);
    });

    return { ...card, sides: newSides };
  }

  async remove(userId: string, deckId: string, cardId: string) {
    const card = await this.cardsDao.getCardById(deckId, cardId);
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found');
    }

    await this.db.transaction(async (tx) => {
      await this.sidesDao.deleteSidesForCard(cardId, tx);
      await this.cardsDao.deleteCard(deckId, cardId, tx);
    });
  }
}
