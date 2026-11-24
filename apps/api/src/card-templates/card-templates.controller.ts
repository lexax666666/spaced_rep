import { Controller, Get, UseGuards } from '@nestjs/common';
import { CardTemplatesService } from './card-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('card-templates')
@UseGuards(JwtAuthGuard)
export class CardTemplatesController {
  constructor(private readonly cardTemplatesService: CardTemplatesService) {}

  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.cardTemplatesService.findAll(userId);
  }
}
