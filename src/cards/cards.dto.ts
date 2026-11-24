import { StepType } from '../db/schema';

export class StepDto {
  // Only on update: the id of an existing step to keep. Omit to add a new step.
  id?: string;
  type: StepType;
  label: string;
  value: Record<string, unknown>;
}

export class CreateCardDto {
  // Omit for a card built by hand rather than from a template.
  templateId?: string;
  steps: StepDto[];
}

export class UpdateCardDto {
  // The card's full list of steps, in order. Existing steps left out are deleted.
  steps: StepDto[];
}
