import { describe, expect, it } from 'vitest';

import { compareTranscript } from './transcriptDiff';

describe('transcriptDiff', () => {
  it('test_transcript_given_reordered_words_expect_only_sequence_matches_highlighted', () => {
    const comparison = compareTranscript('Jeg er her.', 'Her er jeg.');

    expect(comparison.target.map((token) => token.matched)).toEqual([
      false,
      true,
      false,
    ]);
    expect(comparison.spoken.map((token) => token.matched)).toEqual([
      false,
      true,
      false,
    ]);
    expect(comparison.errorRate).toBeCloseTo(2 / 3);
  });

  it('test_transcript_given_repeated_word_missing_expect_first_occurrence_matched', () => {
    const comparison = compareTranscript('Jeg går og går.', 'Jeg går og.');

    expect(comparison.target.map((token) => token.matched)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(comparison.spoken.map((token) => token.matched)).toEqual([
      true,
      true,
      true,
    ]);
  });
});
