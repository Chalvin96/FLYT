import { describe, expect, it } from 'vitest';

import type {
  Block,
  ContentReference,
  LessonPacket,
} from '@/types/lesson-contracts';

import { deriveLessonPages, packetExerciseIds } from './lessonPages';

function paragraph(id: string, value = 'Tekst.'): Block {
  return { kind: 'paragraph', id, spans: [{ kind: 'text', value }] };
}

function chooseExercise(id: string): LessonPacket['exercises'][number] {
  return {
    kind: 'exercise',
    id,
    operation: 'choose',
    objective_id: 'obj-1',
    prompt: [{ kind: 'text', value: 'Choose.' }],
    explanation: null,
    payload: {
      options: [
        { option_id: 'a', text: 'a' },
        { option_id: 'b', text: 'b' },
      ],
      answer_id: 'a',
    },
  };
}

function packet(
  sections: Block[][],
  exercises: string[] = [],
  content?: ContentReference[],
): LessonPacket {
  return {
    schema_version: '4.0',
    id: 'lesson',
    kind: 'grammar',
    language: 'nb-NO',
    title: 'Lesson',
    cefr_level: 'A1',
    goal: 'Practice.',
    objectives: [{ id: 'obj-1', statement: 'Use it.' }],
    content: content ?? [
      ...sections.map((_, index) => ({
        kind: 'section' as const,
        id: `sec-${index}`,
      })),
      ...exercises.map((id) => ({ kind: 'exercise' as const, id })),
    ],
    sections: sections.map((blocks, index) => ({
      kind: 'section' as const,
      id: `sec-${index}`,
      role: 'orient' as const,
      title: `Section ${index}`,
      objective_ids: ['obj-1'],
      blocks,
    })),
    exercises: exercises.map((id) => chooseExercise(id)),
    practice_groups: [],
    media: { audio: [] },
  };
}

describe('deriveLessonPages', () => {
  it('test_derive_lesson_pages_given_short_section_expect_single_page', () => {
    const pages = deriveLessonPages(packet([[paragraph('b1')]]));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      kind: 'section',
      title: 'Section 0',
    });
  });

  it('test_derive_lesson_pages_given_long_section_expect_preserves_all_blocks', () => {
    const blocks = [
      paragraph('b1'),
      paragraph('b2'),
      paragraph('b3'),
      paragraph('b4'),
      paragraph('b5'),
    ];
    const pages = deriveLessonPages(packet([blocks]));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      kind: 'section',
      title: 'Section 0',
      blocks,
    });
  });

  it('test_derive_lesson_pages_given_interleaved_content_expect_authored_order', () => {
    const pages = deriveLessonPages(
      packet(
        [[paragraph('b1')], [paragraph('b2')]],
        ['ex-a', 'ex-b'],
        [
          { kind: 'section', id: 'sec-0' },
          { kind: 'exercise', id: 'ex-a' },
          { kind: 'section', id: 'sec-1' },
          { kind: 'exercise', id: 'ex-b' },
        ],
      ),
    );

    expect(pages.map((page) => page.kind)).toEqual([
      'section',
      'exercise',
      'section',
      'exercise',
    ]);
    expect(
      pages
        .filter((page) => page.kind === 'exercise')
        .map((page) => (page as { exerciseId: string }).exerciseId),
    ).toEqual(['ex-a', 'ex-b']);
    expect(
      pages.map((page) =>
        page.kind === 'section' ? page.sectionId : page.exerciseId,
      ),
    ).toEqual(['sec-0', 'ex-a', 'sec-1', 'ex-b']);
  });

  it('test_derive_lesson_pages_given_unknown_section_reference_expect_throw', () => {
    expect(() =>
      deriveLessonPages(
        packet([[paragraph('b1')]], [], [{ kind: 'section', id: 'ghost' }]),
      ),
    ).toThrow(/unknown section ghost/);
  });

  it('test_derive_lesson_pages_given_unknown_exercise_reference_expect_throw', () => {
    expect(() =>
      deriveLessonPages(
        packet(
          [[paragraph('b1')]],
          ['ex-a'],
          [
            { kind: 'section', id: 'sec-0' },
            { kind: 'exercise', id: 'ghost' },
          ],
        ),
      ),
    ).toThrow(/unknown exercise ghost/);
  });

  it('test_derive_lesson_pages_given_duplicate_reference_expect_throw', () => {
    expect(() =>
      deriveLessonPages(
        packet(
          [[paragraph('b1')]],
          [],
          [
            { kind: 'section', id: 'sec-0' },
            { kind: 'section', id: 'sec-0' },
          ],
        ),
      ),
    ).toThrow(/duplicate content reference sec-0/);
  });

  it('test_derive_lesson_pages_given_omitted_exercise_expect_throw', () => {
    expect(() =>
      deriveLessonPages(
        packet(
          [[paragraph('b1')]],
          ['ex-a'],
          [{ kind: 'section', id: 'sec-0' }],
        ),
      ),
    ).toThrow(/content omits ex-a/);
  });

  it('test_derive_lesson_pages_given_missing_content_expect_throw', () => {
    const legacy = packet([[paragraph('b1')]]);
    delete (legacy as Partial<LessonPacket>).content;
    expect(() => deriveLessonPages(legacy)).toThrow(/content is missing/);
  });

  it('test_packet_exercise_ids_given_reordered_arrays_expect_authored_ids', () => {
    const value = packet(
      [],
      ['y', 'x'],
      [
        { kind: 'exercise', id: 'x' },
        { kind: 'exercise', id: 'y' },
      ],
    );
    expect(packetExerciseIds(value)).toEqual(['x', 'y']);
  });
});
