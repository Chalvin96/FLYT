import type { MasteryBucket, MyCardItem } from '@/types/api';

export const BUCKETS: {
  key: MasteryBucket;
  label: string;
  className: string;
}[] = [
  {
    key: 'not_started',
    label: 'Not started',
    className: 'bg-neutral-subtle text-default',
  },
  {
    key: 'learning',
    label: 'Learning',
    className: 'bg-selected-hovered text-selected',
  },
  {
    key: 'familiar',
    label: 'Familiar',
    className: 'bg-brand-subtle text-selected',
  },
  { key: 'known', label: 'Known', className: 'bg-success-subtle text-success' },
  {
    key: 'mastered',
    label: 'Mastered',
    className: 'bg-success text-success',
  },
];

export type RenderItem =
  | { kind: 'card'; card: MyCardItem }
  | { kind: 'group'; lessonId: number; title: string; cards: MyCardItem[] };

export function buildRenderItems(cards: MyCardItem[]): RenderItem[] {
  const items: RenderItem[] = [];
  const groupIndexByLessonId = new Map<number, number>();
  for (const card of cards) {
    if (card.facet === 'grammar' && card.lesson_id != null) {
      const existingIndex = groupIndexByLessonId.get(card.lesson_id);
      if (existingIndex !== undefined) {
        (
          items[existingIndex] as Extract<RenderItem, { kind: 'group' }>
        ).cards.push(card);
      } else {
        groupIndexByLessonId.set(card.lesson_id, items.length);
        items.push({
          kind: 'group',
          lessonId: card.lesson_id,
          title: card.lesson_title ?? 'Grammar',
          cards: [card],
        });
      }
    } else {
      items.push({ kind: 'card', card });
    }
  }
  return items;
}
