import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCardDto, UpdateCardDto } from './cards.dto';

@Controller('decks/:deckId/cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Param('deckId') deckId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardsService.create(userId, deckId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Param('deckId') deckId: string,
  ) {
    return this.cardsService.findAll(userId, deckId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('deckId') deckId: string,
    @Param('id') id: string,
  ) {
    return this.cardsService.findOne(userId, deckId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('deckId') deckId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardsService.update(userId, deckId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('deckId') deckId: string,
    @Param('id') id: string,
  ) {
    return this.cardsService.remove(userId, deckId, id);
  }
}
