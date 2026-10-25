'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { audioPlaybackController } from './audio-playback';
import { Glyph } from './glyph';
import { Text } from './text';

export type AudioPlayButtonPresentation =
  'inline' | 'compact' | 'compact-quiet' | 'block';
export type AudioPlayButtonSize = 'sm' | 'md';

const PRESENTATION_VARIANTS: Record<
  AudioPlayButtonPresentation,
  { compact: boolean; quiet: boolean; block: boolean }
> = {
  inline: { compact: false, quiet: false, block: false },
  compact: { compact: true, quiet: false, block: false },
  'compact-quiet': { compact: true, quiet: true, block: false },
  block: { compact: false, quiet: false, block: true },
};

export interface AudioPlayButtonProps {
  src?: string | null;
  presentation?: AudioPlayButtonPresentation;
  size?: AudioPlayButtonSize;
  label?: string;
  playingLabel?: string;
  errorLabel?: string;
  unavailableLabel?: string;
}

const ICON_SIZE: Record<AudioPlayButtonSize, string> = {
  sm: 'icon-xs',
  md: 'icon-sm',
};

const COMPACT_DOT_SIZE: Record<AudioPlayButtonSize, string> = {
  sm: 'size-5',
  md: 'size-[30px]',
};

const BLOCK_WAVE_HEIGHTS = [
  'h-[9px]',
  'h-[15px]',
  'h-[11px]',
  'h-[21px]',
  'h-[17px]',
  'h-6',
  'h-5',
  'h-[13px]',
  'h-[23px]',
  'h-4',
  'h-[10px]',
  'h-[18px]',
  'h-3',
  'h-[21px]',
  'h-[14px]',
  'h-2',
];

const subscribeToPlayback = (onChange: () => void) =>
  audioPlaybackController.subscribe(onChange);

function useAudioPlayback(
  src: string | null | undefined,
  pauseOnToggle: boolean,
) {
  const owner = React.useId();
  const [error, setError] = React.useState(false);
  const playing = React.useSyncExternalStore(subscribeToPlayback, () =>
    audioPlaybackController.isPlaying(src, owner),
  );

  const [erroredSource, setErroredSource] = React.useState(src);
  if (erroredSource !== src) {
    setErroredSource(src);
    setError(false);
  }

  React.useEffect(
    () => () => {
      if (
        src &&
        (audioPlaybackController.isPlaying(src, owner) ||
          audioPlaybackController.isPaused(src, owner))
      )
        audioPlaybackController.stop();
    },
    [owner, src],
  );

  function toggle() {
    if (!src) return;
    if (playing) {
      if (pauseOnToggle) return audioPlaybackController.pause();
      return audioPlaybackController.stop();
    }
    if (pauseOnToggle && audioPlaybackController.resume(src, owner)) return;
    setError(false);
    audioPlaybackController.play(src, { onError: () => setError(true) }, owner);
  }
  return { error, playing, toggle };
}

const UNAVAILABLE_TREATMENT = 'border border-dashed border-default text-subtle';

const COMPACT_HOVER =
  'group-hover:border-brand-subtle group-hover:bg-selected group-hover:text-selected';

const COMPACT_RESTING_SURFACE = 'border bg-raised text-subtle';

const COMPACT_RESTING: Record<'default' | 'quiet', string> = {
  default: `border-default ${COMPACT_RESTING_SURFACE} ${COMPACT_HOVER}`,
  quiet: `border-hovered ${COMPACT_RESTING_SURFACE} ${COMPACT_HOVER}`,
};

function stateClassName(error: boolean, playing: boolean) {
  if (error)
    return 'bg-danger-subtle text-danger hover:bg-danger-subtle-hovered';
  if (playing) return 'bg-selected text-selected';
  return 'text-subtle hover:bg-selected hover:text-selected';
}

function buildCompactStateClassName(
  unavailable: boolean,
  error: boolean,
  playing: boolean,
  quiet: boolean,
) {
  if (unavailable) return UNAVAILABLE_TREATMENT;
  if (error)
    return 'border border-danger-subtle bg-danger-subtle text-danger group-hover:bg-danger-subtle-hovered';
  if (playing) return 'border border-brand-subtle bg-selected text-selected';
  return COMPACT_RESTING[quiet ? 'quiet' : 'default'];
}

function buildBlockStateClassName(error: boolean, playing: boolean) {
  if (error)
    return 'border-danger bg-danger-subtle text-danger hover:bg-danger-subtle-hovered';
  if (playing) return 'border-selected bg-selected text-selected';
  return cn(
    'border-brand-subtle bg-selected text-selected',
    'hover:bg-selected-hovered',
    'active:bg-selected-hovered',
  );
}

function buildBlockDiscClassName(error: boolean, unavailable: boolean) {
  if (unavailable) return UNAVAILABLE_TREATMENT;
  if (error) return 'border border-danger text-danger';
  return 'bg-brand-bold text-inverse';
}

function BlockWaveform({
  error,
  playing,
  unavailable,
}: {
  error: boolean;
  playing: boolean;
  unavailable: boolean;
}) {
  const barColor = unavailable
    ? 'bg-[var(--border-default)]'
    : error
      ? 'bg-[var(--border-danger)]'
      : playing
        ? 'bg-[var(--border-selected)]'
        : 'bg-[var(--border-brand-subtle)]';

  return (
    <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
      {BLOCK_WAVE_HEIGHTS.map((height, index) => (
        <span
          className={cn('w-[3px] rounded-full', height, barColor)}
          key={index}
        />
      ))}
    </span>
  );
}

function BlockContent({
  controlContent,
  error,
  playing,
  unavailable,
}: {
  controlContent: React.ReactNode;
  error: boolean;
  playing: boolean;
  unavailable: boolean;
}) {
  const label = unavailable
    ? 'Unavailable'
    : error
      ? 'Retry'
      : playing
        ? 'Playing'
        : 'Listen';

  return (
    <>
      {controlContent}
      <BlockWaveform
        error={error}
        playing={playing}
        unavailable={unavailable}
      />
      <Text as="span" size="medium" weight="semibold" aria-hidden="true">
        {label}
      </Text>
    </>
  );
}

function AudioIcon({
  block,
  unavailable,
  playing,
  size,
}: {
  block: boolean;
  unavailable: boolean;
  playing: boolean;
  size: AudioPlayButtonSize;
}) {
  if (unavailable) return <Glyph size="2xs">—</Glyph>;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={ICON_SIZE[size]}
      aria-hidden="true"
    >
      {playing && block ? (
        <>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </>
      ) : playing ? (
        <rect x="6" y="5" width="12" height="14" rx="2" />
      ) : (
        <polygon points="6,4 20,12 6,20" />
      )}
    </svg>
  );
}

function AudioControlIcon({
  block,
  compact,
  compactStateClasses,
  error,
  playing,
  size,
  unavailable,
}: {
  block: boolean;
  compact: boolean;
  compactStateClasses: string;
  error: boolean;
  playing: boolean;
  size: AudioPlayButtonSize;
  unavailable: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full transition-colors',
        compact &&
          'pointer-events-none group-focus-visible:ring-2 group-focus-visible:ring-[var(--border-focused)] group-focus-visible:ring-offset-1',
        compact && COMPACT_DOT_SIZE[size],
        compact && compactStateClasses,
        block && 'size-[34px] shrink-0',
        block && buildBlockDiscClassName(error, unavailable),
        !compact && !block && 'size-full',
      )}
    >
      <AudioIcon
        block={block}
        unavailable={unavailable}
        playing={playing}
        size={size}
      />
    </span>
  );
}

function buildAudioButtonClassName(
  block: boolean,
  compact: boolean,
  stateClasses: string,
  blockStateClasses: string,
) {
  return cn(
    'group flex shrink-0 cursor-pointer items-center justify-center transition-colors',
    'focus-visible:outline-none',
    !block && 'size-11 rounded-full',
    block &&
      'min-h-11 gap-3 rounded-[var(--control-radius-pill)] border py-1 pr-4 pl-[3px]',
    block &&
      'focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-neutral)]',
    !block &&
      !compact &&
      'focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-1',
    compact && 'bg-transparent hover:bg-transparent',
    block && blockStateClasses,
    !block && !compact && stateClasses,
  );
}

function UnavailableAudio({
  block,
  compact,
  controlContent,
  label,
}: {
  block: boolean;
  compact: boolean;
  controlContent: React.ReactNode;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-state="unavailable"
      className={cn(
        'flex shrink-0 items-center justify-center',
        !block && 'size-11',
        !block && !compact && 'text-subtle',
        block &&
          `min-h-11 cursor-default gap-3 rounded-[var(--control-radius-pill)] py-1 pr-4 pl-[3px] ${UNAVAILABLE_TREATMENT}`,
      )}
    >
      {controlContent}
    </span>
  );
}

function resolveAudioLabel(
  error: boolean,
  playing: boolean,
  labels: { idle: string; playing: string; error: string },
) {
  if (error) return labels.error;
  if (playing) return labels.playing;
  return labels.idle;
}

function resolveAudioState(
  unavailable: boolean,
  error: boolean,
  playing: boolean,
) {
  if (unavailable) return 'unavailable';
  if (error) return 'error';
  if (playing) return 'playing';
  return 'idle';
}

export function AudioPlayButton({
  src,
  presentation = 'inline',
  size = 'md',
  label = 'Play audio',
  playingLabel = 'Playing audio',
  errorLabel = 'Audio failed to play; retry',
  unavailableLabel = 'Audio unavailable',
}: AudioPlayButtonProps) {
  const unavailable = !src;
  const { error, playing, toggle } = useAudioPlayback(
    src,
    presentation === 'block',
  );

  const state = resolveAudioState(unavailable, error, playing);
  const { compact, quiet, block } = PRESENTATION_VARIANTS[presentation];
  const stateClasses = stateClassName(error, playing);
  const compactStateClasses = buildCompactStateClassName(
    unavailable,
    error,
    playing,
    quiet,
  );
  const blockStateClasses = buildBlockStateClassName(error, playing);

  const controlContent = (
    <AudioControlIcon
      block={block}
      compact={compact}
      compactStateClasses={compactStateClasses}
      error={error}
      playing={playing}
      size={size}
      unavailable={unavailable}
    />
  );

  const content = block ? (
    <BlockContent
      controlContent={controlContent}
      error={error}
      playing={playing}
      unavailable={unavailable}
    />
  ) : (
    controlContent
  );

  if (unavailable) {
    return (
      <UnavailableAudio
        block={block}
        compact={compact}
        controlContent={content}
        label={unavailableLabel}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={resolveAudioLabel(error, playing, {
        idle: label,
        playing: playingLabel,
        error: errorLabel,
      })}
      aria-busy={playing}
      data-state={state}
      onClick={toggle}
      className={buildAudioButtonClassName(
        block,
        compact,
        stateClasses,
        blockStateClasses,
      )}
    >
      {content}
    </button>
  );
}
