import type { TileVerdict } from '../answerVerdict';

export function resolveAnswerOptionState({
  checked,
  graded,
  isAnswer,
}: {
  checked: boolean;
  graded: boolean;
  isAnswer: boolean;
}): TileVerdict {
  if (!graded) {
    return checked ? 'selected' : 'idle';
  }
  if (isAnswer) {
    return 'correct';
  }
  return checked ? 'incorrect' : 'revealed';
}
