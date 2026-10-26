import { Glyph, Text } from '@flyt/ui';
import { useId, useState } from 'react';

import { cn } from '@/lib/utils';
import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import { AudioPlayButton } from './AudioPlayButton';
import { disclosureTriggerClassName } from './disclosureTrigger';
import { SpanView } from './SpanView';

type ReadingBlockProps = {
  block: ReadingBlock;
  audio?: AudioAsset | null;
  className?: string;
};

export function ReadingBlock({ block, audio, className }: ReadingBlockProps) {
  const [revealed, setRevealed] = useState(false);
  const translationId = useId();

  return (
    <div
      className={cn(
        'radius-field border border-default bg-raised p-4',
        'min-w-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Text as="p" lang="no" size="large" tone="default">
              <SpanView spans={block.spans} />
            </Text>
          </div>
          <AudioPlayButton asset={audio} label="Play this line" />
        </div>

        {block.translation ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-expanded={revealed}
              aria-controls={translationId}
              className={disclosureTriggerClassName}
            >
              <Glyph size="2xs">{revealed ? '▼' : '▶'}</Glyph>
              {revealed ? 'Hide translation' : 'Show translation'}
            </button>
            <div className="mt-1.5 pl-4" hidden={!revealed}>
              <Text
                as="p"
                id={translationId}
                lang="en"
                size="medium"
                tone="subtle"
              >
                {block.translation}
              </Text>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
