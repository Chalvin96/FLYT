import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { StimulusBlock } from '@/types/lesson-contracts';

import { StimulusView } from './StimulusView';

const dialogue: StimulusBlock[] = [
  {
    kind: 'dialogue',
    turns: [
      {
        speaker: 'Mina',
        text: [{ kind: 'text', value: '«Du skulle ha kjøpt brød.»' }],
      },
      {
        speaker: 'Jon',
        text: [
          { kind: 'text', value: 'Du har ' },
          { kind: 'emphasis', value: 'rett' },
          { kind: 'text', value: '.' },
        ],
      },
    ],
  },
];

describe('StimulusView', () => {
  it('test_stimulus_view_given_dialogue_turns_expect_authored_speakers_and_rich_text_in_order', () => {
    render(<StimulusView blocks={dialogue} />);

    const turns = screen.getAllByRole('listitem');
    expect(turns).toHaveLength(2);
    expect(turns[0]).toHaveTextContent('Mina');
    expect(turns[0]).toHaveTextContent('«Du skulle ha kjøpt brød.»');
    expect(turns[1]).toHaveTextContent('Jon');
    expect(turns[1]).toHaveTextContent('Du har rett.');
    expect(screen.getByText('rett').tagName).toBe('EM');
  });

  it('test_stimulus_view_given_multiple_blocks_expect_packet_order', () => {
    render(
      <StimulusView
        blocks={[
          {
            kind: 'dialogue',
            turns: [
              { speaker: 'First', text: [{ kind: 'text', value: 'One.' }] },
            ],
          },
          {
            kind: 'dialogue',
            turns: [
              { speaker: 'Second', text: [{ kind: 'text', value: 'Two.' }] },
            ],
          },
        ]}
      />,
    );

    const speakers = screen
      .getAllByRole('listitem')
      .map((turn) => turn.textContent);
    expect(speakers).toEqual(['FirstOne.', 'SecondTwo.']);
  });

  it('test_stimulus_view_given_authored_turns_expect_no_invented_narration', () => {
    render(<StimulusView blocks={dialogue} />);

    const region = screen.getByTestId('exercise-stimulus');
    expect(region).toHaveTextContent('Mina');
    expect(region).toHaveTextContent('Jon');
    expect(region.textContent).not.toMatch(/says|replies/i);
  });
});
