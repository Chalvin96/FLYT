import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnchorFieldset, LengthFieldset } from './StoryGenerationFieldsets';

function tabStops(groupName: RegExp) {
  return within(screen.getByRole('radiogroup', { name: groupName }))
    .getAllByRole('radio')
    .filter((radio) => radio.getAttribute('tabindex') === '0');
}

describe('LengthFieldset', () => {
  it('test_length_radiogroup_given_nothing_selected_expect_one_tab_stop_on_the_first_option', () => {
    render(
      <LengthFieldset
        lengthOptions={[80, 140, 200]}
        onSelect={vi.fn()}
        selectedLength={undefined}
      />,
    );

    const stops = tabStops(/Story length/i);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName(/80 words/);
  });

  it('test_length_radiogroup_given_a_selection_expect_the_tab_stop_on_it', () => {
    render(
      <LengthFieldset
        lengthOptions={[80, 140, 200]}
        onSelect={vi.fn()}
        selectedLength={140}
      />,
    );

    const stops = tabStops(/Story length/i);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName(/140 words/);
  });
});

describe('AnchorFieldset', () => {
  const anchors = [
    { type: 'deck', available: false },
    { type: 'common', available: true },
  ] as never[];

  it('test_anchor_radiogroup_given_first_option_unavailable_expect_tab_stop_on_first_available', () => {
    render(
      <AnchorFieldset
        minDeckSize={5}
        onSelect={vi.fn()}
        selectedAnchorType={undefined}
        visibleAnchors={anchors}
      />,
    );

    const stops = tabStops(/Story direction/i);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName(/Vocabulary chosen by Flyt/);
  });
});
