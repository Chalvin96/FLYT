import type {
  Block,
  ExampleBlock,
  ReadingBlock,
} from '@/types/lesson-contracts';

export type DialogueGroup = {
  dialogueId: string;
  turns: ReadingBlock[];
};

export type ReadingGroup =
  | { kind: 'dialogue'; group: DialogueGroup }
  | { kind: 'reading'; block: ReadingBlock };

function isDialogueTurn(block: ReadingBlock): boolean {
  return Boolean(block.dialogue_id);
}

/**
 * Dialogue turns arrive flat in `blocks[]`; the wire format carries identity
 * (`dialogue_id`, `turn_index`) but no nesting, so grouping is the app's job.
 * Consecutive turns render together without moving intervening content.
 */
export function groupReadings(blocks: ReadingBlock[]): ReadingGroup[] {
  const groups: ReadingGroup[] = [];

  for (const block of blocks) {
    if (!isDialogueTurn(block)) {
      groups.push({ kind: 'reading', block });
      continue;
    }

    const dialogueId = block.dialogue_id as string;
    const last = groups.at(-1);
    if (last?.kind === 'dialogue' && last.group.dialogueId === dialogueId) {
      last.group.turns.push(block);
    } else {
      groups.push({ kind: 'dialogue', group: { dialogueId, turns: [block] } });
    }
  }

  return groups;
}

export function speakerIds(turns: ReadingBlock[]): string[] {
  return [...new Set(turns.map((turn) => turn.speaker_id ?? ''))];
}

export type SectionEntry =
  | { kind: 'dialogue'; group: DialogueGroup }
  | { kind: 'example_group'; blocks: ExampleBlock[] }
  | { kind: 'block'; block: Block };

/**
 * Order-preserving view of a section's blocks: consecutive turns of one
 * dialogue and adjacent examples collapse into visual groups at the position
 * of their first block; every other block passes through untouched.
 */
export function groupSectionEntries(blocks: Block[]): SectionEntry[] {
  const entries: SectionEntry[] = [];

  for (const block of blocks) {
    if (block.kind === 'reading' && block.dialogue_id) {
      const dialogueId = block.dialogue_id;
      const last = entries.at(-1);
      if (last?.kind === 'dialogue' && last.group.dialogueId === dialogueId) {
        last.group.turns.push(block);
      } else {
        entries.push({
          kind: 'dialogue',
          group: { dialogueId, turns: [block] },
        });
      }
      continue;
    }

    if (block.kind === 'example') {
      const last = entries.at(-1);
      if (last?.kind === 'example_group') {
        last.blocks.push(block);
      } else {
        entries.push({ kind: 'example_group', blocks: [block] });
      }
      continue;
    }

    if (block.kind === 'examples') {
      const grouped = block.items.map((item) => ({
        kind: 'example' as const,
        ...item,
      }));
      const last = entries.at(-1);
      if (last?.kind === 'example_group') {
        last.blocks.push(...grouped);
      } else {
        entries.push({ kind: 'example_group', blocks: grouped });
      }
      continue;
    }

    entries.push({ kind: 'block', block });
  }

  return entries;
}
