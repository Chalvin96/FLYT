import type { useStoryGenerationSurface } from '@/hooks/storyGeneration/queries';

import type { StoryGenerationSearch } from './StoryGenerationPage';

type Surface = NonNullable<
  Awaited<ReturnType<typeof useStoryGenerationSurface>>['data']
>;

export interface StorySelection {
  providers: Surface['providers'];
  availableProviders: Surface['providers'];
  selectedProvider: Surface['providers'][number] | undefined;
  visibleAnchors: Surface['anchors'];
  availableAnchors: Surface['anchors'];
  selectedAnchor: Surface['anchors'][number] | undefined;
  selectedLength: number | undefined;
  topic: string;
}

/**
 * Derives the form's effective selection from the surface and the URL
 * search: unavailable providers/anchors are never selectable, and an
 * out-of-sync search value falls back to the first available option.
 */
export function buildStorySelection(
  surface: Surface,
  search: StoryGenerationSearch,
): StorySelection {
  const availableProviders = surface.providers.filter(
    (provider) => provider.available,
  );
  const selectedProvider =
    availableProviders.find((provider) => provider.name === search.provider) ??
    availableProviders[0];
  const visibleAnchors = surface.anchors.filter(
    (anchor) => !(surface.deckCollapsesWithFrequency && anchor.type === 'deck'),
  );
  const availableAnchors = visibleAnchors.filter((anchor) => anchor.available);
  const selectedAnchor =
    availableAnchors.find((anchor) => anchor.type === search.anchor) ??
    availableAnchors[0];
  const selectedLength = surface.lengthOptions.includes(search.length ?? 0)
    ? search.length
    : surface.lengthOptions[0];

  return {
    providers: surface.providers,
    availableProviders,
    selectedProvider,
    visibleAnchors,
    availableAnchors,
    selectedAnchor,
    selectedLength,
    topic: search.topic ?? '',
  };
}
