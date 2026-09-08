'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

import { audioPlaybackController } from './audio-playback';

export interface AudioPlayButtonProps {
  src?: string | null;
  tone?: 'inline' | 'standalone' | 'compact';
  size?: 'sm' | 'md';
  label?: string;
  playingLabel?: string;
  errorLabel?: string;
  unavailableLabel?: string;
  className?: string;
}

function useAudioPlayback(src: string | null | undefined) {
  const owner = React.useId();
  const [error, setError] = React.useState(false);
  const [playing, setPlaying] = React.useState(() =>
    audioPlaybackController.isPlaying(src, owner),
  );

  React.useEffect(() => {
    setError(false);
    const update = () =>
      setPlaying(audioPlaybackController.isPlaying(src, owner));
    update();
    const unsubscribe = audioPlaybackController.subscribe(update);
    return () => {
      unsubscribe();
      if (src && audioPlaybackController.isPlaying(src, owner))
        audioPlaybackController.stop();
    };
  }, [owner, src]);

  function toggle() {
    if (!src) return;
    if (playing) return audioPlaybackController.stop();
    setError(false);
    audioPlaybackController.play(src, { onError: () => setError(true) }, owner);
  }
  return { error, playing, toggle };
}

function stateClassName(error: boolean, playing: boolean) {
  if (error)
    return 'bg-destructive-10 text-destructive-80 hover:bg-destructive-20';
  if (playing) return 'bg-primary-10 text-primary-70';
  return 'text-secondary-70 hover:bg-primary-10 hover:text-primary-70';
}

function compactStateClassName(
  unavailable: boolean,
  error: boolean,
  playing: boolean,
) {
  if (unavailable)
    return 'border border-dashed border-secondary-20 text-muted-foreground';
  if (error)
    return 'border-destructive-30 bg-destructive-10 text-destructive-80 hover:bg-destructive-20';
  if (playing) return 'border-primary-30 bg-primary-10 text-primary-70';
  return 'border-secondary-20 bg-secondary-0 text-secondary-70 hover:border-primary-30 hover:bg-primary-10 hover:text-primary-70';
}

function AudioIcon({
  unavailable,
  playing,
  size,
}: {
  unavailable: boolean;
  playing: boolean;
  size: 'sm' | 'md';
}) {
  if (unavailable)
    return <span className="text-sm font-normal leading-none">—</span>;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={size === 'sm' ? 'icon-xs' : 'icon-sm'}
      aria-hidden="true"
    >
      {playing ? (
        <rect x="6" y="5" width="12" height="14" rx="2" />
      ) : (
        <polygon points="6,4 20,12 6,20" />
      )}
    </svg>
  );
}

function UnavailableAudio({
  compact,
  controlContent,
  label,
  className,
}: {
  compact: boolean;
  controlContent: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-state="unavailable"
      className={cn(
        'flex size-11 shrink-0 items-center justify-center',
        !compact && 'text-muted-foreground',
        className,
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

export function AudioPlayButton({
  src,
  tone = 'inline',
  size = 'md',
  label = 'Play audio',
  playingLabel = 'Playing audio',
  errorLabel = 'Audio failed to play; retry',
  unavailableLabel = 'Audio unavailable',
  className,
}: AudioPlayButtonProps) {
  const unavailable = !src;
  const { error, playing, toggle } = useAudioPlayback(src);

  const state = unavailable
    ? 'unavailable'
    : error
      ? 'error'
      : playing
        ? 'playing'
        : 'idle';
  const compact = tone === 'compact';
  const stateClasses = stateClassName(error, playing);
  const compactStateClasses = compactStateClassName(
    unavailable,
    error,
    playing,
  );

  const controlContent = (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full transition-colors',
        compact
          ? cn(
              'pointer-events-none',
              size === 'sm' ? 'size-5' : 'size-7',
              compactStateClasses,
            )
          : 'size-full',
      )}
    >
      <AudioIcon unavailable={unavailable} playing={playing} size={size} />
    </span>
  );

  if (unavailable) {
    return (
      <UnavailableAudio
        compact={compact}
        controlContent={controlContent}
        label={unavailableLabel}
        className={className}
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
      className={cn(
        'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
        compact && 'bg-transparent hover:bg-transparent',
        !compact &&
          tone === 'standalone' &&
          'border border-secondary-20 bg-secondary-0',
        !compact && stateClasses,
        className,
      )}
    >
      {controlContent}
    </button>
  );
}
