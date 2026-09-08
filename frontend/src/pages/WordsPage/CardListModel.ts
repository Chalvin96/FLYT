import type { MasteryBucket, MyCardItem } from '@/types/api';

export const BUCKETS: {
  key: MasteryBucket;
  label: string;
  className: string;
}[] = [
  {
    key: 'not_started',
    label: 'Not started',
    className: 'bg-secondary-10 text-secondary-90',
  },
  {
    key: 'learning',
    label: 'Learning',
    className: 'bg-primary-20 text-primary-90',
  },
  {
    key: 'familiar',
    label: 'Familiar',
    className: 'bg-primary-10 text-primary-90',
  },
  { key: 'known', label: 'Known', className: 'bg-accent-10 text-accent-90' },
  {
    key: 'mastered',
    label: 'Mastered',
    className: 'bg-accent-20 text-accent-90',
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
