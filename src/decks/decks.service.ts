import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DecksDao,
  CreateDeckInput,
  UpdateDeckInput,
} from '../repositories/decks.dao';

@Injectable()
export class DecksService {
  constructor(private readonly decksDao: DecksDao) {}

  async create(userId: string, dto: CreateDeckInput) {
    return this.decksDao.createDeck(userId, dto);
  }

  async findAll(userId: string) {
    return this.decksDao.getDecksForUser(userId);
  }

  async findOne(userId: string, deckId: string) {
    const deck = await this.decksDao.getDeckForUser(userId, deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    return deck;
  }

  async update(userId: string, deckId: string, dto: UpdateDeckInput) {
    const deck = await this.decksDao.updateDeck(userId, deckId, dto);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }
    return deck;
  }

  async remove(userId: string, deckId: string) {
    const deleted = await this.decksDao.deleteDeck(userId, deckId);
    if (!deleted) {
      throw new NotFoundException('Deck not found');
    }
  }
}
