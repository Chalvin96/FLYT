import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WordSpan } from './WordSpan';

describe('WordSpan', () => {
  it('test_word_span_given_interactive_word_expect_click_handler', () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'går' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('test_word_span_given_static_word_expect_plain_text', () => {
    render(<WordSpan text="Oslo" state="mastered" isInteractive={false} />);
    expect(
      screen.queryByRole('button', { name: 'Oslo' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Oslo')).toBeInTheDocument();
  });

  it('test_word_span_given_unresolved_word_expect_browse_state', () => {
    render(
      <WordSpan text="sommeren" state="new" hasLemma={false} isInteractive />,
    );

    const button = screen.getByRole('button', { name: 'sommeren' });
    expect(button).toHaveAttribute('data-state', 'browse');
  });

  it('test_word_span_given_learning_state_expect_data_state_learning', () => {
    render(<WordSpan text="går" state="learning" isInteractive />);

    expect(screen.getByRole('button', { name: 'går' })).toHaveAttribute(
      'data-state',
      'learning',
    );
  });

  it('test_word_span_given_mastered_state_expect_data_state_mastered', () => {
    render(<WordSpan text="går" state="mastered" isInteractive />);

    expect(screen.getByRole('button', { name: 'går' })).toHaveAttribute(
      'data-state',
      'mastered',
    );
  });

  it('test_word_span_given_missing_lemma_expect_data_state_browse', () => {
    render(
      <WordSpan text="sommeren" state="new" hasLemma={false} isInteractive />,
    );

    expect(screen.getByRole('button', { name: 'sommeren' })).toHaveAttribute(
      'data-state',
      'browse',
    );
  });

  it('test_word_span_given_non_interactive_word_expect_no_data_state', () => {
    render(<WordSpan text="Oslo" state="mastered" isInteractive={false} />);

    expect(screen.getByText('Oslo')).not.toHaveAttribute('data-state');
  });

  it('test_interactive_word_given_render_expect_native_button', () => {
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={() => {}} />,
    );

    const word = screen.getByRole('button', { name: 'går' });
    expect(word.tagName).toBe('BUTTON');
    expect(word).toHaveAttribute('type', 'button');
  });

  it('test_interactive_word_given_enter_key_expect_handler_called', async () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    const word = screen.getByRole('button', { name: 'går' });
    word.focus();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('test_interactive_word_given_space_key_expect_handler_called', async () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    const word = screen.getByRole('button', { name: 'går' });
    word.focus();
    await userEvent.keyboard(' ');

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('test_non_interactive_word_given_render_expect_no_role_and_no_tabindex', () => {
    render(<WordSpan text="Oslo" state="mastered" isInteractive={false} />);

    const word = screen.getByText('Oslo');
    expect(word.tagName).toBe('SPAN');
    expect(word).not.toHaveAttribute('role');
    expect(word).not.toHaveAttribute('tabindex');
  });
  it('test_word_span_given_current_word_expect_current_state_and_announcement', () => {
    render(<WordSpan text="går" state="new" current isInteractive />);
    expect(screen.getByRole('button', { name: 'går' })).toHaveAttribute(
      'data-state',
      'current',
    );
    expect(screen.getByRole('button', { name: 'går' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('test_word_span_given_punctuation_in_token_expect_only_word_is_interactive', () => {
    const { container } = render(
      <p>
        <WordSpan text="«kaffe,»" state="new" isInteractive />
      </p>,
    );
    expect(screen.getByRole('button', { name: 'kaffe' })).toHaveTextContent(
      /^kaffe$/,
    );
    expect(container).toHaveTextContent('«kaffe,»');
    expect(
      screen.queryByRole('button', { name: '«kaffe,»' }),
    ).not.toBeInTheDocument();
  });
});
