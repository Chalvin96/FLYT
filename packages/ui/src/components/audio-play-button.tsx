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
      if (src && audioPlaybackController.isPlaying(src, owner)) {
        audioPlaybackController.stop();
      }
    };
  }, [owner, src]);

  function handleClick() {
    if (!src) return;
    if (playing) {
      audioPlaybackController.stop();
      return;
    }
    setError(false);
    audioPlaybackController.play(
      src,
      {
        onError: () => setError(true),
      },
      owner,
    );
  }

  const state = unavailable
    ? 'unavailable'
    : error
      ? 'error'
      : playing
        ? 'playing'
        : 'idle';
  const compact = tone === 'compact';
  const stateClasses = error
    ? 'bg-destructive-10 text-destructive-80 hover:bg-destructive-20'
    : playing
      ? 'bg-primary-10 text-primary-70'
      : 'text-secondary-70 hover:bg-primary-10 hover:text-primary-70';
  const compactStateClasses = unavailable
    ? 'border border-dashed border-secondary-20 text-muted-foreground'
    : error
      ? 'border-destructive-30 bg-destructive-10 text-destructive-80 hover:bg-destructive-20'
      : playing
        ? 'border-primary-30 bg-primary-10 text-primary-70'
        : 'border-secondary-20 bg-secondary-0 text-secondary-70 hover:border-primary-30 hover:bg-primary-10 hover:text-primary-70';

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
      {unavailable ? (
        <span className="text-sm font-normal leading-none">—</span>
      ) : (
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
      )}
    </span>
  );

  if (unavailable) {
    return (
      <span
        role="img"
        aria-label={unavailableLabel}
        title={unavailableLabel}
        data-state={state}
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

  return (
    <button
      type="button"
      aria-label={error ? errorLabel : playing ? playingLabel : label}
      aria-busy={playing}
      data-state={state}
      onClick={handleClick}
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
