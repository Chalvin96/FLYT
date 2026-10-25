import { Accordion, Card } from '@flyt/ui';

import type { MyCardItem } from '@/types/api';

import { CardRow, GrammarGroupRow } from './CardList';
import { buildRenderItems } from './CardListModel';

export function CardListSection({
  cards,
  onCardClick,
}: {
  cards: MyCardItem[];
  onCardClick: (card: MyCardItem) => void;
}) {
  const renderItems = buildRenderItems(cards);

  return (
    <Card clipContent padding="none">
      <Accordion asChild type="multiple">
        <div className="divide-y divide-[var(--border-default)]">
          {renderItems.map((item) =>
            item.kind === 'card' ? (
              <CardRow
                card={item.card}
                key={`card-${item.card.user_card_id}`}
                onClick={() => onCardClick(item.card)}
              />
            ) : (
              <GrammarGroupRow
                cards={item.cards}
                key={`group-${item.lessonId}`}
                title={item.title}
                value={`group-${item.lessonId}`}
              />
            ),
          )}
        </div>
      </Accordion>
    </Card>
  );
}
