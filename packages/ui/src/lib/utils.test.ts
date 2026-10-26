import { describe, expect, it } from 'vitest';

import {
  HEADING_SIZE,
  TEXT_BODY_SIZE,
  TEXT_SIZE,
} from '../components/text-variants';
import { cn, sentenceCaseLabel } from './utils';

function collectFontSizeClasses(): string[] {
  return [
    ...Object.values(TEXT_BODY_SIZE),
    ...Object.values(HEADING_SIZE),
    ...Object.values(TEXT_SIZE),
  ]
    .flatMap((classes) => classes.split(' '))
    .filter((name) => name.startsWith('text-'));
}

describe('cn', () => {
  it('test_cn_given_scale_size_and_text_colour_expect_both_kept', () => {
    for (const size of collectFontSizeClasses()) {
      expect(cn(size, 'text-inverse-subtle').split(' ')).toEqual([
        size,
        'text-inverse-subtle',
      ]);
    }
  });

  it('test_cn_given_two_scale_sizes_expect_last_wins', () => {
    expect(cn('text-body-small', 'text-heading-large')).toBe(
      'text-heading-large',
    );
  });
});

describe('sentenceCaseLabel', () => {
  it('test_sentence_case_label_given_slugs_and_authored_text_expect_readable_case', () => {
    expect(sentenceCaseLabel('recall_fill', 'slug')).toBe('Recall fill');
    expect(sentenceCaseLabel('word-order', 'slug')).toBe('Word order');
    expect(sentenceCaseLabel('chatGPT · A2')).toBe('ChatGPT · A2');
    expect(sentenceCaseLabel('anne-marie')).toBe('Anne-marie');
    expect(sentenceCaseLabel('')).toBe('');
  });
});
