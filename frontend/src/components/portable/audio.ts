import type { AudioAsset } from '@/types/lesson-contracts';

/** True only when the API has supplied a synthesized asset URL. */
export function isPlayableAudio(asset?: AudioAsset | null): boolean {
  return Boolean(asset && asset.status === 'synthesized' && asset.url);
}
