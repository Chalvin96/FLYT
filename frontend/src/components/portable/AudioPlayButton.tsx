import { AudioPlayButton as UiAudioPlayButton } from '@flyt/ui';

import type { AudioAsset } from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';

type LessonAudioButtonProps = {
  asset?: AudioAsset | null;
  src?: string | null;
  label?: string;
  tone?: 'inline' | 'standalone';
  className?: string;
};

export function AudioPlayButton({
  asset,
  src,
  label = 'Play audio',
  tone = 'inline',
  className,
}: LessonAudioButtonProps) {
  const playable = isPlayableAudio(asset);

  if (!asset || !playable) return null;

  return (
    <UiAudioPlayButton
      src={src ?? asset.url}
      tone={tone}
      label={label}
      playingLabel="Stop audio"
      className={className}
    />
  );
}
