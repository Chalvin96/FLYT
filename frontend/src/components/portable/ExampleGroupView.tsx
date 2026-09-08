import { cn } from '@/lib/utils';
import type { AudioAsset, ExampleBlock, Spans } from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';
import { AudioPlayButton } from './AudioPlayButton';
import { SpanView } from './SpanView';

const EMPTY_AUDIO_BY_ID: Record<string, AudioAsset> = {};

function ExampleContent({
  en,
  no,
  audio,
}: {
  en: Spans;
  no: Spans;
  audio?: AudioAsset | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <p
          data-testid="example-norwegian"
          lang="no"
          className="min-w-0 flex-1 font-medium text-foreground"
        >
          <SpanView spans={no} />
        </p>
        {isPlayableAudio(audio) ? (
          <AudioPlayButton asset={audio} label="Play example" />
        ) : null}
      </div>
      <p
        data-testid="example-translation"
        lang="en"
        className="type-caption text-muted-foreground"
      >
        <SpanView spans={en} />
      </p>
    </div>
  );
}

function NumberedExampleLine({
  index,
  en,
  no,
  audio,
}: {
  index: number;
  en: Spans;
  no: Spans;
  audio?: AudioAsset | null;
}) {
  return (
    <li className={cn(index > 0 && 'border-t border-border')}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 px-3 py-2">
        <span
          aria-hidden="true"
          className="type-label-xs grid size-7 place-items-center rounded-full bg-primary-5 text-primary-80"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <ExampleContent en={en} no={no} audio={audio} />
      </div>
    </li>
  );
}

export function ExampleGroupView({
  blocks,
  audioById = EMPTY_AUDIO_BY_ID,
}: {
  blocks: ExampleBlock[];
  audioById?: Record<string, AudioAsset>;
}) {
  return (
    <ol role="list" className="overflow-hidden radius-field bg-card">
      {blocks.map((block, index) => (
        <NumberedExampleLine
          key={block.id}
          index={index}
          no={block.no}
          en={block.en}
          audio={block.audio_id ? audioById[block.audio_id] : null}
        />
      ))}
    </ol>
  );
}
