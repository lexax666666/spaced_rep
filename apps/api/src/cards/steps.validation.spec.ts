import { BadRequestException } from '@nestjs/common';
import {
  MAX_STEPS_PER_CARD,
  MAX_STEP_LABEL_LENGTH,
  parseSteps,
} from './steps.validation';

describe('parseSteps', () => {
  // A step with nothing to recall.
  const note = {
    label: 'Hook',
    questionType: 'RICH_TEXT',
    questionValue: { a: 1 },
  };
  const validStep = {
    label: 'Meaning',
    questionType: 'RICH_TEXT',
    questionValue: { a: 1 },
    answerType: 'RICH_TEXT',
    answerValue: { b: 2 },
  };
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

  it('should accept a question and an answer of different kinds', () => {
    const [step] = parseSteps([
      { ...validStep, questionType: 'AUDIO', answerType: 'CHESS_POSITION' },
    ]);

    expect(step.questionType).toBe('AUDIO');
    expect(step.answerType).toBe('CHESS_POSITION');
  });

  it('should return an empty answer for a step sent without one', () => {
    expect(parseSteps([note])).toEqual([
      { ...note, answerType: null, answerValue: null },
    ]);
  });

  it('should accept null for both answer fields', () => {
    const [step] = parseSteps([
      { ...note, answerType: null, answerValue: null },
    ]);

    expect(step.answerType).toBeNull();
    expect(step.answerValue).toBeNull();
  });

  it.each([
    ['steps is not an array', { steps: 'x' }.steps],
    ['a step is not an object', ['x']],
    ['a step is null', [null]],
    ['id is null', [{ ...validStep, id: null }]],
    ['id is not a UUID', [{ ...validStep, id: 'abc' }]],
    [
      'the question is sent as type and value',
      [{ label: 'Front', type: 'RICH_TEXT', value: {} }],
    ],
    ['questionType is unknown', [{ ...validStep, questionType: 'HOLOGRAM' }]],
    ['questionType is CUSTOM', [{ ...validStep, questionType: 'CUSTOM' }]],
    ['questionType is null', [{ ...validStep, questionType: null }]],
    ['label is missing', [{ questionType: 'RICH_TEXT', questionValue: {} }]],
    ['label is blank', [{ ...validStep, label: ' ' }]],
    [
      'label is too long',
      [{ ...validStep, label: 'x'.repeat(MAX_STEP_LABEL_LENGTH + 1) }],
    ],
    ['label contains a NUL character', [{ ...validStep, label: 'a\u0000b' }]],
    ['questionValue is a string', [{ ...validStep, questionValue: 'text' }]],
    ['questionValue is an array', [{ ...validStep, questionValue: [] }]],
    ['questionValue is null', [{ ...validStep, questionValue: null }]],
    [
      'questionValue contains a NUL character',
      [{ ...validStep, questionValue: { nested: ['a\u0000b'] } }],
    ],
    ['answerType is unknown', [{ ...validStep, answerType: 'HOLOGRAM' }]],
    ['answerType is CUSTOM', [{ ...validStep, answerType: 'CUSTOM' }]],
    ['answerValue is a string', [{ ...validStep, answerValue: 'text' }]],
    ['answerValue is an array', [{ ...validStep, answerValue: [] }]],
    [
      'answerValue contains a NUL character',
      [{ ...validStep, answerValue: { nested: ['a\u0000b'] } }],
    ],
    [
      'answerType comes without answerValue',
      [{ ...note, answerType: 'AUDIO' }],
    ],
    ['answerValue comes without answerType', [{ ...note, answerValue: {} }]],
    [
      'answerType is null but answerValue is not',
      [{ ...validStep, answerType: null }],
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
    expect(() =>
      parseSteps([validStep, { ...validStep, questionValue: 1 }]),
    ).toThrow('steps[1].questionValue: must be a JSON object');
  });

  it('should say that the two answer fields go together', () => {
    expect(() => parseSteps([{ ...note, answerType: 'AUDIO' }])).toThrow(
      'steps[0]: answerType and answerValue must be sent together',
    );
  });
});
