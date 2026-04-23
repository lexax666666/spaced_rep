export class SideDto {
  type: 'RICH_TEXT' | 'VIDEO' | 'AUDIO' | 'CHESS_POSITION';
  label: string;
  value: unknown;
}

export class CreateCardDto {
  templateType: 'VOCAB' | 'CHESS' | 'STANDARD_FLASH_CARD' | 'CUSTOM';
  sides: SideDto[];
}

export class UpdateCardDto {
  sides: SideDto[];
}
