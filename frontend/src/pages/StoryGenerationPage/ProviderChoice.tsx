import { Badge, ChoiceTile, Text } from '@flyt/ui';
import { LockKeyhole } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import type { StoryGenerationProvider } from '@/types/api';

import { PROVIDER_COPY } from './constants';
import {
  formatRemainingPercent,
  getProviderAvailabilityMessage,
} from './format';

export function ProviderChoice({
  provider,
  selected,
  tabStop,
  onSelect,
}: {
  provider: StoryGenerationProvider;
  selected: boolean;
  tabStop: boolean;
  onSelect: () => void;
}) {
  const copy = PROVIDER_COPY[provider.name] ?? {
    label: provider.name,
    description: provider.model,
  };
  const availabilityMessage = getProviderAvailabilityMessage(provider);

  return (
    <div className="space-y-2">
      <ChoiceTile
        layout="row"
        onClick={onSelect}
        selected={selected}
        tabIndex={tabStop ? 0 : -1}
        unavailable={!provider.available}
      >
        <span className="flex items-center justify-between gap-3">
          <Text as="span" size="large" weight="semibold" tone="default">
            {copy.label}
          </Text>
          <ProviderUsageBadge provider={provider} />
        </span>
        <Text
          as="span"
          size="medium"
          tone={selected && provider.available ? 'default' : 'subtle'}
        >
          {provider.available ? copy.description : availabilityMessage}
        </Text>
      </ChoiceTile>
      {!provider.available &&
      (provider.action === 'link_account' ||
        provider.action === 'relink_account') ? (
        <div className="pl-3">
          <Text as="p" size="small" tone="subtle">
            {provider.action === 'relink_account' ? 'Reconnect' : 'Connect'} it
            in{' '}
            <Link
              to="/account"
              className="text-brand underline-offset-2 hover:underline"
            >
              <Text as="span" weight="semibold">
                Account settings
              </Text>
            </Link>
            .
          </Text>
        </div>
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
      <Badge tone="neutral">
        <LockKeyhole className="mr-1 icon-xs" aria-hidden />
        Locked
      </Badge>
    );
  }

  const usageLabel = formatRemainingPercent(provider.remainingPercent);
  if (usageLabel === null) {
    return null;
  }

  return <Badge tone="brand">{usageLabel}</Badge>;
}
