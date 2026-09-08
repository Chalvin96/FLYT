import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AudioAsset, SectionPacket } from '@/types/lesson-contracts';

import { BlockView } from './BlockView';
import { ExampleGroupView } from './ExampleGroupView';

describe('BlockView', () => {
  it('applies table column languages to cells', () => {
    render(
      <BlockView
        block={{
          kind: 'table',
          id: 'tbl-1',
          col_langs: ['en', 'no'],
          headers: [
            [{ kind: 'text', value: 'Gender' }],
            [{ kind: 'text', value: 'Form' }],
          ],
          rows: [
            [
              [{ kind: 'text', value: 'neuter' }],
              [{ kind: 'text', value: 'stort' }],
            ],
          ],
        }}
      />,
    );

    expect(screen.getByRole('cell', { name: 'stort' })).toHaveAttribute(
      'lang',
      'no',
    );
    expect(screen.getByRole('cell', { name: 'neuter' })).toHaveAttribute(
      'lang',
      'en',
    );
  });

  it('renders headings and nested callouts', () => {
    render(
      <BlockView
        block={{
          kind: 'callout',
          id: 'callout-1',
          level: 'tip',
          blocks: [
            {
              kind: 'heading',
              id: 'heading-1',
              level: 3,
              spans: [{ kind: 'text', value: 'Forms' }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Forms' })).toBeInTheDocument();
  });

  it('test_example_block_given_playable_audio_expect_control_beside_norwegian', () => {
    const audio: AudioAsset = {
      id: 'audio-1',
      url: 'https://media.example.test/audio/lesson-a/audio-1.wav',
      path: 'audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav',
      mime: 'audio/wav',
      duration_ms: 400,
      status: 'synthesized',
    };

    render(
      <BlockView
        block={{
          kind: 'example',
          id: 'example-1',
          no: [{ kind: 'text', value: 'Hun tar bussen.' }],
          en: [{ kind: 'text', value: 'She takes the bus.' }],
          audio_id: 'audio-1',
        }}
        audioById={{ 'audio-1': audio }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Play example' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('example-norwegian')).toHaveAttribute(
      'lang',
      'no',
    );
    expect(screen.getByTestId('example-translation')).toHaveAttribute(
      'lang',
      'en',
    );
  });

  it('test_example_given_unresolved_audio_expect_text_only_fallback', () => {
    render(
      <BlockView
        block={{
          kind: 'example',
          id: 'example-without-asset',
          no: [{ kind: 'text', value: 'Jeg blir hjemme.' }],
          en: [{ kind: 'text', value: 'I am staying home.' }],
          audio_id: 'audio-unresolved',
        }}
        audioById={{}}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /play/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Jeg blir hjemme.')).toBeInTheDocument();
  });

  it('test_example_group_given_multiple_blocks_expect_numbered_rows_in_one_list', () => {
    render(
      <ExampleGroupView
        blocks={[
          {
            kind: 'example',
            id: 'example-1',
            no: [{ kind: 'text', value: 'Jeg vil gjerne ha kaffe.' }],
            en: [{ kind: 'text', value: 'I would like coffee.' }],
          },
          {
            kind: 'example',
            id: 'example-2',
            no: [
              {
                kind: 'text',
                value:
                  'Jeg vil gjerne ha en stor kaffe med melk og et rundstykke med ost, takk.',
              },
            ],
            en: [
              {
                kind: 'text',
                value:
                  'I would like a large coffee with milk and a bread roll with cheese, please.',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Jeg vil gjerne ha en stor kaffe med melk og et rundstykke med ost, takk.',
      ),
    ).toBeInTheDocument();
  });

  it('test_block_view_given_grouped_examples_expect_authored_items_rendered', () => {
    render(
      <BlockView
        block={{
          kind: 'examples',
          id: 'examples-1',
          items: [
            {
              id: 'example-1',
              no: [{ kind: 'text', value: 'Jeg leser.' }],
              en: [{ kind: 'text', value: 'I read.' }],
            },
            {
              id: 'example-2',
              no: [{ kind: 'text', value: 'Du skriver.' }],
              en: [{ kind: 'text', value: 'You write.' }],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Jeg leser.')).toBeInTheDocument();
    expect(screen.getByText('Du skriver.')).toBeInTheDocument();
  });

  it('test_section_render_given_all_block_and_span_kinds_expect_full_contract', () => {
    const fiveSpans = [
      { kind: 'text', value: 'plain' },
      { kind: 'emphasis', value: 'emphasis' },
      { kind: 'strong', value: 'strong' },
      { kind: 'code', value: 'code' },
      { kind: 'foreign_term', value: 'lending', lang: 'no' },
    ] as const;

    const tenBlocks: SectionPacket['blocks'] = [
      {
        kind: 'heading',
        id: 'b-heading',
        level: 3,
        spans: [{ kind: 'text', value: 'Heading text' }],
      },
      { kind: 'paragraph', id: 'b-paragraph', spans: [...fiveSpans] },
      {
        kind: 'reading',
        id: 'b-reading',
        spans: [{ kind: 'text', value: 'Reading text' }],
        translation: 'Reading translation',
        audio_id: null,
        dialogue_id: null,
      },
      {
        kind: 'list',
        id: 'b-list',
        ordered: true,
        items: [[{ kind: 'text', value: 'List item' }]],
      },
      {
        kind: 'rule',
        id: 'b-rule',
        statement: [{ kind: 'text', value: 'Rule statement' }],
      },
      {
        kind: 'example',
        id: 'b-example',
        no: [{ kind: 'text', value: 'Example no' }],
        en: [{ kind: 'text', value: 'Example en' }],
      },
      {
        kind: 'example',
        id: 'b-example-2',
        no: [{ kind: 'text', value: 'Second example no' }],
        en: [{ kind: 'text', value: 'Second example en' }],
      },
      {
        kind: 'table',
        id: 'b-table',
        col_langs: ['no', 'en'],
        headers: [
          [{ kind: 'text', value: 'Norsk' }],
          [{ kind: 'text', value: 'English' }],
        ],
        rows: [
          [
            [{ kind: 'text', value: 'Table cell no' }],
            [{ kind: 'text', value: 'Table cell en' }],
          ],
        ],
      },
      {
        kind: 'callout',
        id: 'b-callout',
        level: 'note',
        blocks: [
          {
            kind: 'paragraph',
            id: 'b-callout-paragraph',
            spans: [{ kind: 'text', value: 'Callout paragraph' }],
          },
        ],
      },
    ];

    const blockMarkers: Array<[SectionPacket['blocks'][number], RegExp]> = [
      [tenBlocks[0], /heading text/i],
      [tenBlocks[2], /reading text/i],
      [tenBlocks[3], /list item/i],
      [tenBlocks[4], /rule statement/i],
      [tenBlocks[5], /example no/i],
      [tenBlocks[6], /second example no/i],
      [tenBlocks[7], /table cell no/i],
      [tenBlocks[8], /callout paragraph/i],
    ];
    for (const [block, marker] of blockMarkers) {
      const { unmount } = render(<BlockView block={block} />);
      expect(screen.getByText(marker)).toBeInTheDocument();
      unmount();
    }

    render(
      <BlockView
        block={{
          kind: 'paragraph',
          id: 'b-paragraph',
          spans: [...fiveSpans],
        }}
      />,
    );

    expect(screen.getByText('plain')).toBeInTheDocument();
    expect(
      screen.getByText('emphasis', { selector: 'em' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('strong', { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('code', { selector: 'code' })).toBeInTheDocument();
    expect(
      screen.getByText('lending', { selector: 'span[lang="no"]' }),
    ).toBeInTheDocument();
  });
});
