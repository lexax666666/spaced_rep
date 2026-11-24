import { Injectable } from '@nestjs/common';
import {
  CardTemplate,
  CardTemplatesDao,
} from '../repositories/card-templates.dao';

@Injectable()
export class CardTemplatesService {
  constructor(private readonly cardTemplatesDao: CardTemplatesDao) {}

  /** The built-in templates plus the user's own. */
  async findAll(userId: string): Promise<CardTemplate[]> {
    return this.cardTemplatesDao.getTemplatesForUser(userId);
  }
}
