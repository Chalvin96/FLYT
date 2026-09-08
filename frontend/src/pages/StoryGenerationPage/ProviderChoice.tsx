import { Badge } from '@flyt/ui';
import { LockKeyhole } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import type { StoryGenerationProvider } from '@/types/api';

import { PROVIDER_COPY } from './constants';
import {
  formatRemainingPercent,
  getProviderAvailabilityMessage,
} from './format';

export function ProviderChoice({
  provider,
  selected,
  onSelect,
}: {
  provider: StoryGenerationProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  const copy = PROVIDER_COPY[provider.name] ?? {
    label: provider.name,
    description: provider.model,
  };
  const availabilityMessage = getProviderAvailabilityMessage(provider);

  return (
    <div className="space-y-2">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-disabled={!provider.available}
        tabIndex={selected ? 0 : -1}
        onClick={() => {
          if (provider.available) onSelect();
        }}
        className={cn(
          'flex w-full flex-col gap-1 radius-field border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'border-primary-70 bg-primary-10 shadow-inset'
            : 'border-border bg-white-100 hover:border-secondary-30 hover:bg-secondary-10',
          !provider.available &&
            'cursor-not-allowed border-secondary-20 bg-secondary-10/60 opacity-80 hover:border-secondary-20 hover:bg-secondary-10/60',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="type-body font-semibold text-foreground">
            {copy.label}
          </span>
          <ProviderUsageBadge provider={provider} />
        </span>
        <span className="type-caption text-muted-foreground">
          {provider.available ? copy.description : availabilityMessage}
        </span>
      </button>
      {!provider.available &&
      (provider.action === 'link_account' ||
        provider.action === 'relink_account') ? (
        <p className="pl-3 type-caption-sm text-muted-foreground">
          {provider.action === 'relink_account' ? 'Reconnect' : 'Connect'} it in{' '}
          <Link
            to="/account"
            className="font-semibold text-primary-80 underline-offset-2 hover:underline"
          >
            Account settings
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

export function ProviderUsageBadge({
  provider,
}: {
  provider: StoryGenerationProvider;
}) {
  if (!provider.available) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-warning-30 bg-warning-10 type-caption-sm text-warning-80"
      >
        <LockKeyhole className="mr-1 icon-xs" aria-hidden />
        Locked
      </Badge>
    );
  }

  const usageLabel = formatRemainingPercent(provider.remainingPercent);
  if (usageLabel === null) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className="shrink-0 border-primary-30 bg-primary-10 type-caption-sm text-primary-90"
    >
      {usageLabel}
    </Badge>
  );
}
