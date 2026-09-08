import { K_CLOZE_BLANK_RE } from './constants';

export function getClozeSentenceSegments(sentence: string): string[] {
  if (!K_CLOZE_BLANK_RE.test(sentence)) {
    return [sentence];
  }
  return sentence.split(/_{3,}/);
}

export function exercisePromptId(exerciseId: string): string {
  return `exercise-prompt-${exerciseId}`;
}

export function spanPlainText(spans: { value: string }[]): string {
  return spans.map((span) => span.value).join('');
}
