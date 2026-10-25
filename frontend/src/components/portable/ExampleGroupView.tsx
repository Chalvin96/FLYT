import { Heading, Text } from '@flyt/ui';

import { cn } from '@/lib/utils';
import type {
  AudioAsset,
  ExampleBlock,
  ExampleTeachingRole,
  Spans,
} from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';
import { AudioPlayButton } from './AudioPlayButton';
import { SpanView } from './SpanView';

const EMPTY_AUDIO_BY_ID: Record<string, AudioAsset> = {};

const ROLE_PRESENTATION: Record<
  ExampleTeachingRole,
  {
    accessibleLabel: string | null;
    chipClassName: string;
    marker: string | null;
    markerClassName: string;
    railClassName: string;
    visibleLabel: string | null;
  }
> = {
  model: {
    accessibleLabel: null,
    chipClassName: 'bg-brand-subtle text-selected',
    marker: null,
    markerClassName: '',
    railClassName: 'border-transparent',
    visibleLabel: null,
  },
  incorrect: {
    accessibleLabel: 'Incorrect example: ',
    chipClassName: 'bg-danger-subtle text-danger',
    marker: '✗',
    markerClassName: 'text-danger',
    railClassName: 'border-danger',
    visibleLabel: 'Incorrect',
  },
  caution: {
    accessibleLabel: 'Use with care: ',
    chipClassName: 'bg-warning-subtle text-warning',
    marker: '!',
    markerClassName:
      'inline-grid size-4 place-items-center rounded-full bg-warning-subtle text-warning',
    railClassName: 'border-warning',
    visibleLabel: 'Use with care',
  },
};

function normalizeTeachingRole(role: unknown): ExampleTeachingRole {
  return role === 'incorrect' || role === 'caution' ? role : 'model';
}

function ExampleContent({
  en,
  no,
  audio,
  role,
  showVisibleLabel,
}: {
  en: Spans;
  no: Spans;
  audio?: AudioAsset | null;
  role: ExampleTeachingRole;
  showVisibleLabel: boolean;
}) {
  const presentation = ROLE_PRESENTATION[role];
  return (
    <div className="min-w-0">
      {showVisibleLabel && presentation.visibleLabel ? (
        <p
          lang="en"
          className={cn(
            'mb-1',
            role === 'incorrect' ? 'text-danger' : 'text-warning',
          )}
        >
          <Heading as="span" size="xxsmall">
            {presentation.visibleLabel}
          </Heading>
        </p>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="break-words">
            <Text
              as="p"
              data-testid="example-norwegian"
              lang="no"

              tone="default"
            >
              {presentation.marker ? (
                <span
                  aria-hidden="true"
                  data-testid="example-role-marker"
                  className={cn('mr-1.5', presentation.markerClassName)}
                >
                  {presentation.marker}
                </span>
              ) : null}
              <SpanView spans={no} />
            </Text>
          </div>
          <div className="mt-0.5 text-pretty">
            <Text
              as="p"
              data-testid="example-translation"
              lang="en"
              size="medium"
              tone="subtle"
            >
              <SpanView spans={en} />
            </Text>
          </div>
        </div>
        {role !== 'incorrect' && isPlayableAudio(audio) ? (
          <AudioPlayButton asset={audio} label="Play example" />
        ) : null}
      </div>
    </div>
  );
}

function NumberedExampleLine({
  index,
  en,
  no,
  audio,
  role,
  showOrdinal,
}: {
  index: number;
  en: Spans;
  no: Spans;
  audio?: AudioAsset | null;
  role: ExampleTeachingRole;
  showOrdinal: boolean;
}) {
  const presentation = ROLE_PRESENTATION[role];
  return (
    <li
      data-teaching-role={role}
      className={cn(
        'border-l-2',
        presentation.railClassName,
        index > 0 && 'border-t border-t-default',
      )}
    >
      {showOrdinal && presentation.accessibleLabel ? (
        <span className="sr-only" lang="en">
          {presentation.accessibleLabel}
        </span>
      ) : null}
      <div
        className={cn(
          'grid items-start py-2',
          showOrdinal
            ? 'grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-2.5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-3 sm:px-3'
            : 'grid-cols-[minmax(0,1fr)] px-3 py-2.5 sm:py-3',
        )}
      >
        {showOrdinal ? (
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 grid size-6 place-items-center rounded-full sm:size-7',
              presentation.chipClassName,
            )}
          >
            <Heading as="span" size="xxsmall">
              {String(index + 1).padStart(2, '0')}
            </Heading>
          </span>
        ) : null}
        <ExampleContent
          en={en}
          no={no}
          audio={audio}
          role={role}
          showVisibleLabel={!showOrdinal}
        />
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
  const showOrdinals = blocks.length > 1;
  return (
    <ol role="list" className="overflow-hidden radius-field bg-raised">
      {blocks.map((block, index) => {
        const role = normalizeTeachingRole(block.teaching_role);
        return (
          <NumberedExampleLine
            key={block.id}
            index={index}
            no={block.no}
            en={block.en}
            role={role}
            showOrdinal={showOrdinals}
            audio={block.audio_id ? audioById[block.audio_id] : null}
          />
        );
      })}
    </ol>
  );
}
