import { describe, expect, it } from 'vitest';

import { answerVerdictStatusText, type AnswerVerdict } from './answerVerdict';

const VERDICTS: AnswerVerdict[] = [
  'idle',
  'selected',
  'correct',
  'incorrect',
  'revealed',
  'wrong-flash',
];

describe('answer verdict vocabulary', () => {
  it('test_answer_verdict_given_each_verdict_expect_status_text_from_the_vocabulary', () => {
    const statusText = Object.fromEntries(
      VERDICTS.map((verdict) => [verdict, answerVerdictStatusText[verdict]]),
    );

    expect(statusText).toEqual({
      idle: undefined,
      selected: 'selected',
      correct: 'correct',
      incorrect: 'incorrect',
      revealed: undefined,
      'wrong-flash': 'Incorrect — adjust your answer and try again.',
    });
  });

  it('test_answer_verdict_given_graded_verdict_expect_status_text_defined', () => {
    for (const verdict of ['correct', 'incorrect'] as const) {
      expect(answerVerdictStatusText[verdict]).toBeTruthy();
    }
  });
});
