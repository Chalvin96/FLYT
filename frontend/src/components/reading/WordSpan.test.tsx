import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WordSpan } from './WordSpan';

describe('WordSpan', () => {
  it('renders a button for interactive words', () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'går' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders plain text for non-interactive words', () => {
    render(<WordSpan text="Oslo" state="mastered" isInteractive={false} />);
    expect(
      screen.queryByRole('button', { name: 'Oslo' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Oslo')).toBeInTheDocument();
  });

  it('renders unresolved words without a persistent colored background', () => {
    render(
      <WordSpan text="sommeren" state="new" hasLemma={false} isInteractive />,
    );

    const button = screen.getByRole('button', { name: 'sommeren' });
    expect(button).toHaveClass('bg-transparent');
    expect(button).not.toHaveClass('bg-secondary-10');
    expect(button).not.toHaveClass('bg-warning-10');
  });

  it('test_interactive_word_given_render_expect_button_role_and_tabindex_zero', () => {
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={() => {}} />,
    );

    const word = screen.getByRole('button', { name: 'går' });
    expect(word.tagName).toBe('SPAN');
    expect(word).toHaveAttribute('tabindex', '0');
  });

  it('test_interactive_word_given_enter_keydown_expect_handler_called', () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'går' }), {
      key: 'Enter',
    });

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('test_interactive_word_given_space_keydown_expect_handler_called_and_scroll_prevented', () => {
    const onClick = vi.fn();
    render(
      <WordSpan text="går" state="learning" isInteractive onClick={onClick} />,
    );

    const word = screen.getByRole('button', { name: 'går' });
    const event = createEvent.keyDown(word, { key: ' ' });
    fireEvent(word, event);

    expect(onClick).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('test_non_interactive_word_given_render_expect_no_role_and_no_tabindex', () => {
    render(<WordSpan text="Oslo" state="mastered" isInteractive={false} />);

    const word = screen.getByText('Oslo');
    expect(word.tagName).toBe('SPAN');
    expect(word).not.toHaveAttribute('role');
    expect(word).not.toHaveAttribute('tabindex');
  });
});
