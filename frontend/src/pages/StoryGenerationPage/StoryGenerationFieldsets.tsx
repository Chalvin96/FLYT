import { cn } from '@/lib/utils';

import { AnchorChoice } from './AnchorChoice';
import { ProviderChoice } from './ProviderChoice';
import { radioGroupKeyDown } from './radioGroupKeyboard';
import type { StorySelection } from './storySelection';

type Anchor = StorySelection['visibleAnchors'][number];
type Provider = StorySelection['providers'][number];

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
      <legend className="type-label text-muted-foreground">
        Build it from
      </legend>
      <div
        aria-label="Story direction"
        className="space-y-2"
        onKeyDown={radioGroupKeyDown((index) => {
          const anchor = visibleAnchors[index];
          if (anchor) onSelect(anchor.type);
        })}
        role="radiogroup"
      >
        {visibleAnchors.map((anchor) => (
          <AnchorChoice
            anchor={anchor}
            key={anchor.type}
            minDeckSize={minDeckSize}
            onSelect={() => onSelect(anchor.type)}
            selected={selectedAnchorType === anchor.type}
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
      <legend className="type-label text-muted-foreground">Length</legend>
      <div
        aria-label="Story length"
        className="flex gap-2"
        onKeyDown={radioGroupKeyDown((index) => {
          const length = lengthOptions[index];
          if (length !== undefined) onSelect(length);
        })}
        role="radiogroup"
      >
        {lengthOptions.map((length) => (
          <button
            aria-checked={selectedLength === length}
            className={cn(
              'min-h-11 flex-1 radius-field border px-3 type-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selectedLength === length
                ? 'border-primary-70 bg-primary-10 text-primary-90 shadow-inset'
                : 'border-border bg-white-100 text-muted-foreground hover:border-secondary-30 hover:text-foreground',
            )}
            key={length}
            onClick={() => onSelect(length)}
            role="radio"
            tabIndex={selectedLength === length ? 0 : -1}
            type="button"
          >
            {length} words
          </button>
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
      <legend className="type-label text-muted-foreground">Written by</legend>
      <div
        aria-label="Story provider"
        className="space-y-2"
        onKeyDown={radioGroupKeyDown((index) => {
          const provider = providers[index];
          if (provider) onSelect(provider.name);
        })}
        role="radiogroup"
      >
        {providers.map((provider) => (
          <ProviderChoice
            key={provider.name}
            onSelect={() => onSelect(provider.name)}
            provider={provider}
            selected={selectedProviderName === provider.name}
          />
        ))}
      </div>
    </fieldset>
  );
}
