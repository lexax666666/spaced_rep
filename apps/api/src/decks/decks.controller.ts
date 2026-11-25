import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DecksService } from './decks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/validation';
import { createDeckSchema, updateDeckSchema } from './decks.dto';
import type { CreateDeckDto, UpdateDeckDto } from './decks.dto';

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body(new ZodValidationPipe(createDeckSchema)) dto: CreateDeckDto,
  ) {
    return this.decksService.create(userId, dto);
  }

  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.decksService.findAll(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decksService.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDeckSchema)) dto: UpdateDeckDto,
  ) {
    return this.decksService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.decksService.remove(userId, id);
  }
}
