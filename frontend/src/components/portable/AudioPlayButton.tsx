import { AudioPlayButton as UiAudioPlayButton } from '@flyt/ui';
import type { AudioPlayButtonPresentation } from '@flyt/ui';

import type { AudioAsset } from '@/types/lesson-contracts';

import { isPlayableAudio } from './audio';

type LessonAudioButtonProps = {
  asset?: AudioAsset | null;
  src?: string | null;
  label?: string;
  playingLabel?: string;
  presentation?: AudioPlayButtonPresentation;
  unavailable?: 'hide' | 'show';
};

export function AudioPlayButton({
  asset,
  src,
  label = 'Play audio',
  playingLabel = 'Stop audio',
  presentation = 'inline',
  unavailable = 'hide',
}: LessonAudioButtonProps) {
  const playable = isPlayableAudio(asset);

  if (!asset || !playable) {
    if (unavailable === 'hide') return null;
    return <UiAudioPlayButton presentation={presentation} label={label} />;
  }

  return (
    <UiAudioPlayButton
      presentation={presentation}
      src={src ?? asset.url}
      label={label}
      playingLabel={playingLabel}
    />
  );
}
