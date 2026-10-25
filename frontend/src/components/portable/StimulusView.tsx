import { Heading, Text } from '@flyt/ui';

import { sentenceCaseLabel } from '@/lib/utils';
import type { DialogueTurn, StimulusBlock } from '@/types/lesson-contracts';

import { SpanView } from './SpanView';

export function StimulusView({ blocks }: { blocks: StimulusBlock[] }) {
  return (
    <div className="flex flex-col gap-3" data-testid="exercise-stimulus">
      {blocks.map((block, index) => (
        <DialogueTurns key={index} turns={block.turns} />
      ))}
    </div>
  );
}

function DialogueTurns({ turns }: { turns: DialogueTurn[] }) {
  return (
    <ol
      className="flex flex-col gap-2.5"
      data-testid="dialogue-stimulus"
      role="list"
    >
      {turns.map((turn, index) => (
        <li
          key={index}
          className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
        >
          <Heading as="span" size="xxsmall" tone="subtle">
            {sentenceCaseLabel(turn.speaker)}
          </Heading>
          <div className="min-w-0 break-words">
            <Text as="p" lang="no" size="large" tone="default">
              <SpanView spans={turn.text} />
            </Text>
          </div>
        </li>
      ))}
    </ol>
  );
}
