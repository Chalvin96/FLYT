import { useId, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';
import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import { AudioPlayButton } from './AudioPlayButton';
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
        'radius-field border border-border bg-card p-4',
        'min-w-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            lang="no"
            className="type-body min-w-0 flex-1 leading-roomy font-medium text-foreground"
          >
            <SpanView spans={block.spans} />
          </p>
          <AudioPlayButton asset={audio} label="Play this line" />
        </div>

        {block.translation ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((value) => !value)}
              aria-expanded={revealed}
              aria-controls={translationId}
              className="!px-0 !py-0 h-auto justify-start gap-1.5 text-left type-caption font-medium text-secondary-70 hover:bg-transparent hover:text-secondary-90"
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                {revealed ? '▼' : '▶'}
              </span>
              {revealed ? 'Hide translation' : 'Show translation'}
            </Button>
            <p
              id={translationId}
              lang="en"
              hidden={!revealed}
              className="mt-1.5 pl-4 type-caption text-muted-foreground"
            >
              {block.translation}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
