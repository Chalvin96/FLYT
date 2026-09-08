import { audioPlaybackController } from '@flyt/ui';
import { Play, Square } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/common/Button/Button';
import { cn } from '@/lib/utils';
import type { AudioAsset, ReadingBlock } from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';
import { AudioPlayButton } from './AudioPlayButton';
import { speakerIds, type DialogueGroup } from './dialogueGrouping';
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
        className={cn(
          'radius-field min-w-0 max-w-[85%] border p-3 transition-colors',
          active
            ? 'border-primary-30 bg-primary-10'
            : 'border-border bg-secondary-5',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {turn.speaker_name ? (
              <p className="type-label mb-1 text-muted-foreground">
                {turn.speaker_name}
              </p>
            ) : null}
            <p lang="no" className="type-body leading-roomy text-foreground">
              <SpanView spans={turn.spans} />
            </p>
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
          <p lang="en" className="type-caption mt-1.5 text-muted-foreground">
            {turn.translation}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Plays a dialogue's turns in authored order through one media element.
 *
 * Duration timers cannot represent buffering, failure, or the learner
 * stopping playback, so sequencing rides on the audio elements' own
 * `ended`/`error` events. A run token invalidates callbacks from a previous
 * run after stop/unmount, and turns without a playable asset are skipped
 * rather than pretended through.
 */
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
  // Two speakers read as a conversation when sides alternate. Three or more
  // become unreadable that way, so they stay in a single column.
  const alternating = speakers.length === 2;
  const playing = activeIndex !== null;
  const hasTranslations = group.turns.some((turn) => turn.translation);

  return (
    <section
      aria-label={title ?? 'Dialogue'}
      className={cn(
        'radius-section border border-border bg-card p-4',
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h4 className="type-section font-semibold text-foreground">
          {title ?? 'Dialogue'}
        </h4>
        <div className="flex items-center gap-2">
          {hasTranslations ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTranslations((value) => !value)}
              aria-expanded={showTranslations}
              aria-controls={translationId}
              className="!px-0 !py-0 h-auto justify-start gap-1.5 text-left type-caption font-medium text-secondary-70 hover:bg-transparent hover:text-secondary-90"
            >
              <span aria-hidden="true" className="text-[10px] leading-none">
                {showTranslations ? '▼' : '▶'}
              </span>
              {showTranslations ? 'Hide translation' : 'Show translation'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPlayableAudio}
            onClick={() => (playing ? stop() : playFrom(0, ++runRef.current))}
          >
            {playing ? (
              <Square aria-hidden="true" className="size-3.5" />
            ) : (
              <Play aria-hidden="true" className="size-3.5" />
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
