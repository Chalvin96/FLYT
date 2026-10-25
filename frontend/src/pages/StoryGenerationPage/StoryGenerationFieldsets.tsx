import { ChoiceTile, Heading } from '@flyt/ui';

import { buildRadioGroupKeyDownHandler } from '@/lib/radioGroupKeyboard';

import { AnchorChoice } from './AnchorChoice';
import { ProviderChoice } from './ProviderChoice';
import type { StorySelection } from './storySelection';

type Anchor = StorySelection['visibleAnchors'][number];
type Provider = StorySelection['providers'][number];

function fallbackTabStopIndex<T>(
  items: T[],
  isAvailable: (item: T) => boolean,
) {
  const firstAvailable = items.findIndex(isAvailable);
  return firstAvailable === -1 ? 0 : firstAvailable;
}

function isTabStop<T>(
  items: T[],
  index: number,
  isAvailable: (item: T) => boolean,
  isSelected: boolean,
  hasSelection: boolean,
) {
  return hasSelection
    ? isSelected
    : index === fallbackTabStopIndex(items, isAvailable);
}

export function AnchorFieldset({
  minDeckSize,
  onSelect,
  selectedAnchorType,
  visibleAnchors,
}: {
  minDeckSize: number;
  onSelect: (anchorType: Anchor['type']) => void;
  selectedAnchorType: Anchor['type'] | undefined;
  visibleAnchors: Anchor[];
}) {
  return (
    <fieldset className="space-y-3">
      <legend>
        <Heading as="span" size="xxsmall" tone="subtle">
          Build it from
        </Heading>
      </legend>
      <div
        aria-label="Story direction"
        className="space-y-2"
        onKeyDown={buildRadioGroupKeyDownHandler((index) => {
          const anchor = visibleAnchors[index];
          if (anchor) onSelect(anchor.type);
        })}
        role="radiogroup"
      >
        {visibleAnchors.map((anchor, index) => (
          <AnchorChoice
            anchor={anchor}
            key={anchor.type}
            minDeckSize={minDeckSize}
            onSelect={() => onSelect(anchor.type)}
            selected={selectedAnchorType === anchor.type}
            tabStop={isTabStop(
              visibleAnchors,
              index,
              (candidate) => candidate.available,
              selectedAnchorType === anchor.type,
              selectedAnchorType !== undefined,
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function LengthFieldset({
  lengthOptions,
  onSelect,
  selectedLength,
}: {
  lengthOptions: number[];
  onSelect: (length: number) => void;
  selectedLength: number | undefined;
}) {
  return (
    <fieldset className="space-y-3">
      <legend>
        <Heading as="span" size="xxsmall" tone="subtle">
          Length
        </Heading>
      </legend>
      <div
        aria-label="Story length"
        className="flex gap-2"
        onKeyDown={buildRadioGroupKeyDownHandler((index) => {
          const length = lengthOptions[index];
          if (length !== undefined) onSelect(length);
        })}
        role="radiogroup"
      >
        {lengthOptions.map((length, index) => (
          <ChoiceTile
            key={length}
            layout="inline"
            onClick={() => onSelect(length)}
            selected={selectedLength === length}
            tabIndex={
              isTabStop(
                lengthOptions,
                index,
                () => true,
                selectedLength === length,
                selectedLength !== undefined,
              )
                ? 0
                : -1
            }
          >
            {length} words
          </ChoiceTile>
        ))}
      </div>
    </fieldset>
  );
}

export function ProviderFieldset({
  onSelect,
  providers,
  selectedProviderName,
}: {
  onSelect: (providerName: string) => void;
  providers: Provider[];
  selectedProviderName: string | undefined;
}) {
  return (
    <fieldset className="space-y-3">
      <legend>
        <Heading as="span" size="xxsmall" tone="subtle">
          Written by
        </Heading>
      </legend>
      <div
        aria-label="Story provider"
        className="space-y-2"
        onKeyDown={buildRadioGroupKeyDownHandler((index) => {
          const provider = providers[index];
          if (provider) onSelect(provider.name);
        })}
        role="radiogroup"
      >
        {providers.map((provider, index) => (
          <ProviderChoice
            key={provider.name}
            onSelect={() => onSelect(provider.name)}
            provider={provider}
            selected={selectedProviderName === provider.name}
            tabStop={isTabStop(
              providers,
              index,
              (candidate) => candidate.available,
              selectedProviderName === provider.name,
              selectedProviderName !== undefined,
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
