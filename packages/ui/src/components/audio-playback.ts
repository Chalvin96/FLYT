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
      callbacks,
      onEnded: () => this.finish(active, 'ended'),
      onError: () => this.finish(active, 'error'),
    };
    this.active = active;
    audio.addEventListener('ended', active.onEnded);
    audio.addEventListener('error', active.onError);
    this.notify();

    try {
      const playback = audio.play();
      playback?.catch(active.onError);
    } catch {
      active.onError();
    }
    return true;
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
