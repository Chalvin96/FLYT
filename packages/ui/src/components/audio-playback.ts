export type AudioPlaybackCallbacks = {
  onEnded?: () => void;
  onError?: () => void;
  onStopped?: () => void;
};

export type AudioPlaybackOwner = string | symbol;

type ActivePlayback = {
  audio: HTMLAudioElement;
  src: string;
  owner?: AudioPlaybackOwner;
  paused: boolean;
  playAttempt: number;
  callbacks: AudioPlaybackCallbacks;
  onEnded: () => void;
  onError: () => void;
};

export class AudioPlaybackController {
  private active: ActivePlayback | null = null;

  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isPlaying(
    src: string | null | undefined,
    owner?: AudioPlaybackOwner,
  ): boolean {
    return Boolean(
      src &&
      this.active?.src === src &&
      !this.active.paused &&
      (owner === undefined || this.active.owner === owner),
    );
  }

  isPaused(
    src: string | null | undefined,
    owner?: AudioPlaybackOwner,
  ): boolean {
    return Boolean(
      src &&
      this.active?.src === src &&
      this.active.paused &&
      (owner === undefined || this.active.owner === owner),
    );
  }

  play(
    src: string,
    callbacks: AudioPlaybackCallbacks = {},
    owner?: AudioPlaybackOwner,
  ): boolean {
    if (!src) return false;

    this.stop();

    const audio = new Audio(src);
    const active: ActivePlayback = {
      audio,
      src,
      owner,
      paused: false,
      playAttempt: 0,
      callbacks,
      onEnded: () => this.finish(active, 'ended'),
      onError: () => this.finish(active, 'error'),
    };
    this.active = active;
    audio.addEventListener('ended', active.onEnded);
    audio.addEventListener('error', active.onError);
    this.notify();

    this.startPlayback(active);
    return true;
  }

  pause(): void {
    const active = this.active;
    if (!active || active.paused) return;
    active.playAttempt += 1;
    active.audio.pause();
    active.paused = true;
    this.notify();
  }

  resume(src: string, owner?: AudioPlaybackOwner): boolean {
    const active = this.active;
    if (!active || !this.isPaused(src, owner)) return false;
    active.paused = false;
    this.notify();

    this.startPlayback(active);
    return true;
  }

  private startPlayback(active: ActivePlayback): void {
    const attempt = ++active.playAttempt;
    const onError = () => {
      if (this.active === active && active.playAttempt === attempt) {
        active.onError();
      }
    };

    try {
      const playback = active.audio.play();
      playback?.catch(onError);
    } catch {
      onError();
    }
  }

  stop(): void {
    const active = this.active;
    if (!active) return;
    active.audio.pause();
    this.finish(active, 'stopped');
  }

  private finish(
    active: ActivePlayback,
    reason: 'ended' | 'error' | 'stopped',
  ) {
    if (this.active !== active) return;

    active.audio.removeEventListener('ended', active.onEnded);
    active.audio.removeEventListener('error', active.onError);
    this.active = null;
    this.notify();

    if (reason === 'ended') active.callbacks.onEnded?.();
    if (reason === 'error') active.callbacks.onError?.();
    if (reason === 'stopped') active.callbacks.onStopped?.();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const audioPlaybackController = new AudioPlaybackController();
