export class CreateDeckDto {
  name: string;
  description?: string;
  newCardsPerDay: number;
  reviewCardsPerDay: number;
  suspendNewCards?: boolean;
  fsrsRequestRetention?: number;
}

export class UpdateDeckDto {
  name?: string;
  description?: string;
  newCardsPerDay?: number;
  reviewCardsPerDay?: number;
  suspendNewCards?: boolean;
  fsrsRequestRetention?: number;
}
