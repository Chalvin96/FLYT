import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChoiceTile } from './choice-tile';

describe('ChoiceTile', () => {
  it('test_choice_tile_given_unselected_expect_radio_role_and_resting_surface', () => {
    render(<ChoiceTile selected={false}>20 cards</ChoiceTile>);

    const tile = screen.getByRole('radio', { name: '20 cards' });
    expect(tile).toHaveAttribute('aria-checked', 'false');
    expect(tile).toHaveAttribute('data-state', 'idle');
    expect(tile).toHaveClass('bg-raised');
  });

  it('test_choice_tile_given_selected_expect_aria_checked_and_selected_surface', () => {
    render(<ChoiceTile selected>20 cards</ChoiceTile>);

    const tile = screen.getByRole('radio', { name: '20 cards' });
    expect(tile).toHaveAttribute('aria-checked', 'true');
    expect(tile).toHaveAttribute('data-state', 'selected');
    expect(tile).toHaveClass('aria-checked:bg-selected');
  });

  it('test_choice_tile_given_unavailable_expect_own_surface_and_no_activation', () => {
    const onClick = vi.fn();
    render(
      <ChoiceTile announceAs="toggle" onClick={onClick} unavailable>
        Neuter nouns
      </ChoiceTile>,
    );

    const tile = screen.getByRole('button', { name: 'Neuter nouns' });
    expect(tile).toHaveAttribute('aria-disabled', 'true');
    expect(tile).toHaveAttribute('data-state', 'unavailable');
    expect(tile).toHaveClass('aria-disabled:bg-neutral');
    fireEvent.click(tile);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('test_choice_tile_given_announce_as_toggle_expect_aria_pressed', () => {
    render(
      <ChoiceTile announceAs="toggle" selected>
        20 cards
      </ChoiceTile>,
    );

    expect(screen.getByRole('button', { name: '20 cards' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('test_choice_tile_given_layout_prop_expect_matching_arrangement', () => {
    render(
      <>
        <ChoiceTile announceAs="toggle" selected={false}>
          Stacked
        </ChoiceTile>
        <ChoiceTile announceAs="toggle" layout="row" selected={false}>
          Rowed
        </ChoiceTile>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Stacked' })).toHaveClass(
      'items-center',
    );
    expect(screen.getByRole('button', { name: 'Rowed' })).toHaveClass(
      'text-left',
    );
  });
});
