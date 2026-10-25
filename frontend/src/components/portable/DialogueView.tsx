import {
  audioPlaybackController,
  Button,
  Glyph,
  Heading,
  Text,
} from '@flyt/ui';
import { Play, Square } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn, sentenceCaseLabel } from '@/lib/utils';
import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';
import { AudioPlayButton } from './AudioPlayButton';
import { speakerIds, type DialogueGroup } from './dialogueGrouping';
import { disclosureTriggerClassName } from './disclosureTrigger';
import { SpanView } from './SpanView';

type DialogueViewProps = {
  group: DialogueGroup;
  audioById?: Record<string, AudioAsset>;
  title?: string;
  className?: string;
};

type PlayFrom = (index: number, run: number) => void;
const EMPTY_AUDIO_BY_ID: Record<string, AudioAsset> = {};

function TurnRow({
  turn,
  audio,
  aligned,
  active,
  showTranslation,
}: {
  turn: ReadingBlock;
  audio?: AudioAsset | null;
  aligned: boolean;
  active: boolean;
  showTranslation: boolean;
}) {
  return (
    <li
      className={cn(
        'flex w-full gap-2',
        aligned ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        data-testid={`dialogue-turn-${turn.id}`}
        data-active={active}
        className={cn(
          'radius-field min-w-0 max-w-[85%] border p-3 transition-colors',
          active
            ? 'border-brand-subtle bg-selected'
            : 'border-default bg-neutral',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {turn.speaker_name ? (
              <p className="mb-1">
                <Heading
                  as="span"
                  size="xxsmall"
                  tone={active ? 'default' : 'subtle'}
                >
                  {sentenceCaseLabel(turn.speaker_name)}
                </Heading>
              </p>
            ) : null}
            <Text as="p" lang="no" size="large" tone="default">
              <SpanView spans={turn.spans} />
            </Text>
          </div>
          <AudioPlayButton
            asset={audio}
            label={
              turn.speaker_name
                ? `Play ${turn.speaker_name}'s line`
                : 'Play dialogue line'
            }
          />
        </div>
        {showTranslation && turn.translation ? (
          <div className="mt-1.5">
            <Text
              as="p"
              lang="en"
              size="medium"
              tone={active ? 'default' : 'subtle'}
            >
              {turn.translation}
            </Text>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DialogueView({
  group,
  audioById = EMPTY_AUDIO_BY_ID,
  title,
  className,
}: DialogueViewProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const runRef = useRef(0);
  const playFromRef = useRef<PlayFrom>(() => undefined);
  const [sequenceOwner] = useState(() => Symbol('dialogue-sequence'));
  const translationId = useId();

  const playableSrcs = useMemo(
    () =>
      group.turns.map((turn) => {
        if (!turn.audio_id) return null;
        const asset = audioById[turn.audio_id];
        return isPlayableAudio(asset) ? (asset.url as string) : null;
      }),
    [group.turns, audioById],
  );
  const hasPlayableAudio = playableSrcs.some(Boolean);

  const stop = useCallback(() => {
    runRef.current += 1;
    audioPlaybackController.stop();
    setActiveIndex(null);
  }, []);

  useEffect(() => stop, [stop]);

  const playFrom = useCallback(
    (index: number, run: number) => {
      if (run !== runRef.current) return;
      let next = index;
      while (next < playableSrcs.length && !playableSrcs[next]) {
        next += 1;
      }
      if (next >= playableSrcs.length) {
        stop();
        return;
      }
      const src = playableSrcs[next];
      if (!src) {
        stop();
        return;
      }
      setActiveIndex(next);
      const started = audioPlaybackController.play(
        src,
        {
          onEnded: () => {
            if (run !== runRef.current) return;
            playFromRef.current(next + 1, run);
          },
          onError: () => {
            if (run === runRef.current) stop();
          },
          onStopped: () => {
            if (run === runRef.current) setActiveIndex(null);
          },
        },
        sequenceOwner,
      );
      if (!started && run === runRef.current) stop();
    },
    [playableSrcs, sequenceOwner, stop],
  );

  useEffect(() => {
    playFromRef.current = playFrom;
  }, [playFrom]);

  const speakers = speakerIds(group.turns);
  const alternating = speakers.length === 2;
  const playing = activeIndex !== null;
  const hasTranslations = group.turns.some((turn) => turn.translation);

  return (
    <section
      aria-label={title ?? 'Dialogue'}
      className={cn(
        'radius-section border border-default bg-raised p-4',
        className,
      )}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Heading as="h4" size="medium" tone="default">
          {title ?? 'Dialogue'}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          {hasTranslations ? (
            <button
              type="button"
              onClick={() => setShowTranslations((value) => !value)}
              aria-expanded={showTranslations}
              aria-controls={translationId}
              className={disclosureTriggerClassName}
            >
              <Glyph size="2xs">{showTranslations ? '▼' : '▶'}</Glyph>
              {showTranslations ? 'Hide translation' : 'Show translation'}
            </button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPlayableAudio}
            onClick={() => (playing ? stop() : playFrom(0, ++runRef.current))}
          >
            {playing ? (
              <Square aria-hidden="true" className="size-4" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            {playing ? 'Stop' : 'Play all'}
          </Button>
        </div>
      </header>

      <ul id={translationId} role="list" className="flex flex-col gap-2.5">
        {group.turns.map((turn, index) => (
          <TurnRow
            key={turn.id}
            turn={turn}
            audio={turn.audio_id ? audioById[turn.audio_id] : null}
            aligned={alternating && turn.speaker_id === speakers[1]}
            active={activeIndex === index}
            showTranslation={showTranslations}
          />
        ))}
      </ul>
    </section>
  );
}
