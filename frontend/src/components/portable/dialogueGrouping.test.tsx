import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardInfo } from '@/components/flashcard/FlashCardInfo/FlashCardInfo';
import type { Block, ReadingBlock } from '@/types/lesson-contracts';

import { groupReadings, groupSectionEntries } from './dialogueGrouping';

function turn(id: string, dialogueId: string, turnIndex: number): ReadingBlock {
  return {
    kind: 'reading',
    id,
    spans: [{ kind: 'text', value: id }],
    translation: id,
    dialogue_id: dialogueId,
    speaker_id: 'speaker',
    speaker_name: 'Speaker',
    turn_index: turnIndex,
  };
}

describe('dialogueGrouping', () => {
  it('test_group_section_entries_given_consecutive_examples_expect_one_ordered_group', () => {
    const example = (id: string): Block => ({
      kind: 'example',
      id,
      no: [{ kind: 'text', value: id }],
      en: [{ kind: 'text', value: id }],
    });

    const entries = groupSectionEntries([
      example('example-1'),
      example('example-2'),
      {
        kind: 'paragraph',
        id: 'paragraph-1',
        spans: [{ kind: 'text', value: 'Intervening content.' }],
      },
      example('example-3'),
    ]);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      kind: 'example_group',
      blocks: [{ id: 'example-1' }, { id: 'example-2' }],
    });
    expect(entries[1]).toMatchObject({
      kind: 'block',
      block: { kind: 'paragraph' },
    });
    expect(entries[2]).toMatchObject({
      kind: 'example_group',
      blocks: [{ kind: 'example', id: 'example-3' }],
    });
  });

  it('test_group_section_entries_given_nonconsecutive_dialogue_expect_authored_order', () => {
    const blocks: Block[] = [
      turn('turn-1', 'dialogue-1', 1),
      {
        kind: 'paragraph',
        id: 'paragraph-1',
        spans: [{ kind: 'text', value: 'Intervening content.' }],
      },
      turn('turn-2', 'dialogue-1', 2),
    ];

    const entries = groupSectionEntries(blocks);

    expect(entries.map((entry) => entry.kind)).toEqual([
      'dialogue',
      'block',
      'dialogue',
    ]);
    expect(
      entries
        .filter((entry) => entry.kind === 'dialogue')
        .map((entry) => entry.group.turns.map((item) => item.id)),
    ).toEqual([['turn-1'], ['turn-2']]);
  });

  it('test_group_readings_given_consecutive_turns_expect_one_group_without_reordering', () => {
    const groups = groupReadings([
      turn('turn-2', 'dialogue-1', 2),
      turn('turn-1', 'dialogue-1', 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('dialogue');
    if (groups[0].kind === 'dialogue') {
      expect(groups[0].group.turns.map((item) => item.id)).toEqual([
        'turn-2',
        'turn-1',
      ]);
    }
  });

  it('test_flashcard_info_given_separated_same_dialogue_runs_expect_unique_render_keys', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    render(
      <FlashCardInfo
        section={{
          kind: 'section',
          id: 'section-1',
          role: 'model',
          title: 'Dialogue',
          objective_ids: [],
          blocks: [
            turn('turn-1', 'dialogue-1', 1),
            {
              kind: 'paragraph',
              id: 'paragraph-1',
              spans: [{ kind: 'text', value: 'Intervening content.' }],
            },
            turn('turn-2', 'dialogue-1', 2),
          ],
        }}
      />,
    );

    expect(screen.getAllByText('turn-1')).toHaveLength(1);
    expect(screen.getAllByText('turn-2')).toHaveLength(1);
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('same key'),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });
});
