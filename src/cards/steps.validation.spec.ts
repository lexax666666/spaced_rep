import { BadRequestException } from '@nestjs/common';
import {
  MAX_STEPS_PER_CARD,
  MAX_STEP_LABEL_LENGTH,
  parseSteps,
} from './steps.validation';

describe('parseSteps', () => {
  const validStep = { type: 'RICH_TEXT', label: 'Meaning', value: { a: 1 } };
  const stepId = '0198a1b2-c3d4-7e5f-8a6b-0123456789ab';

  it('should return the steps with only the known fields', () => {
    const result = parseSteps([{ ...validStep, id: stepId, extra: 'x' }]);

    expect(result).toEqual([{ ...validStep, id: stepId }]);
  });

  it('should leave id out when none is given', () => {
    expect(parseSteps([validStep])[0]).not.toHaveProperty('id');
  });

  it('should accept an empty list', () => {
    expect(parseSteps([])).toEqual([]);
  });

  it.each([
    ['steps is not an array', { steps: 'x' }.steps],
    ['a step is not an object', ['x']],
    ['a step is null', [null]],
    ['id is null', [{ ...validStep, id: null }]],
    ['id is not a UUID', [{ ...validStep, id: 'abc' }]],
    ['type is unknown', [{ ...validStep, type: 'HOLOGRAM' }]],
    ['type is CUSTOM', [{ ...validStep, type: 'CUSTOM' }]],
    ['label is missing', [{ type: 'RICH_TEXT', value: {} }]],
    ['label is blank', [{ ...validStep, label: ' ' }]],
    [
      'label is too long',
      [{ ...validStep, label: 'x'.repeat(MAX_STEP_LABEL_LENGTH + 1) }],
    ],
    ['label contains a NUL character', [{ ...validStep, label: 'a\u0000b' }]],
    ['value is a string', [{ ...validStep, value: 'text' }]],
    ['value is an array', [{ ...validStep, value: [] }]],
    ['value is null', [{ ...validStep, value: null }]],
    [
      'value contains a NUL character',
      [{ ...validStep, value: { nested: ['a\u0000b'] } }],
    ],
    [
      'an id is repeated',
      [
        { ...validStep, id: stepId },
        { ...validStep, id: stepId },
      ],
    ],
    [
      'there are too many steps',
      Array.from({ length: MAX_STEPS_PER_CARD + 1 }, () => validStep),
    ],
  ])('should reject when %s', (_case, input) => {
    expect(() => parseSteps(input)).toThrow(BadRequestException);
  });

  it('should name the offending step in the message', () => {
    expect(() => parseSteps([validStep, { ...validStep, value: 1 }])).toThrow(
      'steps[1].value: must be a JSON object',
    );
  });
});
