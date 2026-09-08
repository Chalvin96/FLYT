import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useCallback, useState } from 'react';

import type { StoryParagraph } from './storyParagraphs';
import { StoryParagraphView } from './StoryParagraphView';

const renderSpy = vi.fn();

vi.mock('./WordSpan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./WordSpan')>();
  return {
    WordSpan: (props: Parameters<typeof actual.WordSpan>[0]) => {
      renderSpy(props.text);
      return actual.WordSpan(props);
    },
  };
});

const PARAGRAPH: StoryParagraph = [
  { text: 'Hei', lemmaUuid: 'lemma-1', state: 'new', isToken: true },
  { text: ' ', lemmaUuid: null, state: 'mastered', isToken: false },
  { text: 'verden', lemmaUuid: 'lemma-2', state: 'learning', isToken: true },
  { text: '.', lemmaUuid: null, state: 'mastered', isToken: true },
];

describe('StoryParagraphView', () => {
  it('test_story_paragraph_given_unrelated_parent_state_change_expect_no_rerender', async () => {
    const user = userEvent.setup();
    renderSpy.mockClear();

    function Parent() {
      const [count, setCount] = useState(0);
      const onOpenLemma = useCallback(() => {}, []);
      return (
        <>
          <button type="button" onClick={() => setCount((n) => n + 1)}>
            bump {count}
          </button>
          <StoryParagraphView
            paragraph={PARAGRAPH}
            paragraphIndex={0}
            onOpenLemma={onOpenLemma}
          />
        </>
      );
    }

    render(<Parent />);
    expect(renderSpy).toHaveBeenCalledTimes(2);

    renderSpy.mockClear();
    await user.click(screen.getByRole('button', { name: /bump/ }));
    expect(screen.getByRole('button', { name: /bump 1/ })).toBeInTheDocument();
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('test_story_paragraph_given_word_click_expect_lemma_uuid_and_text', async () => {
    const user = userEvent.setup();
    const onOpenLemma = vi.fn();

    render(
      <StoryParagraphView
        paragraph={PARAGRAPH}
        paragraphIndex={0}
        onOpenLemma={onOpenLemma}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Hei' }));

    expect(onOpenLemma).toHaveBeenCalledWith('lemma-1', 'Hei');
  });

  it('test_story_paragraph_given_punctuation_token_expect_plain_span', () => {
    render(
      <StoryParagraphView
        paragraph={PARAGRAPH}
        paragraphIndex={0}
        onOpenLemma={() => {}}
      />,
    );

    // A token with no letter is not clickable even though isToken is true.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
