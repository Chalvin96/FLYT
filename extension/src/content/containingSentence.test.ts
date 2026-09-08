import { describe, expect, it } from 'vitest';

import {
  containingSentence,
  selectionTextOffset,
} from './containingSentence';

describe('containingSentence', () => {
  it('test_containing_sentence_given_word_in_paragraph_expect_matching_sentence', () => {
    expect(
      containingSentence(
        'Første setning. Jeg leser en bok hver dag. Siste setning.',
        'bok',
      ),
    ).toBe('Jeg leser en bok hver dag.');
  });

  it('test_containing_sentence_given_missing_selection_expect_selection', () => {
    expect(containingSentence('En annen tekst.', 'bok')).toBe('bok');
  });

  it('test_containing_sentence_given_repeated_word_expect_sentence_at_selected_offset', () => {
    const text = 'Bok er et substantiv. Jeg leser en bok hver dag.';
    const secondBok = text.lastIndexOf('bok');
    expect(containingSentence(text, 'bok', secondBok)).toBe(
      'Jeg leser en bok hver dag.',
    );
  });

  it('test_selection_text_offset_given_nested_range_expect_container_offset', () => {
    const container = document.createElement('p');
    container.innerHTML = 'Første bok. <strong>Andre bok</strong> her.';
    const textNode = container.querySelector('strong')?.firstChild;
    if (!textNode) throw new Error('Expected nested text node');
    const range = document.createRange();
    range.setStart(textNode, 'Andre '.length);
    range.setEnd(textNode, 'Andre bok'.length);

    expect(selectionTextOffset(container, range)).toBe('Første bok. Andre '.length);
  });
});
