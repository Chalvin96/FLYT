import { Text } from '@flyt/ui';

import type { ImportQuota } from '@/types/api';

import { formatReadingNumber } from './readingDisplay';

interface ImportQuotaBadgeProps {
  quota: ImportQuota | undefined;
  className?: string;
  id?: string;
}

export function ImportQuotaBadge({
  quota,
  className,
  id,
}: ImportQuotaBadgeProps) {
  if (!quota) {
    return null;
  }
  const limit = quota.limit;
  const used = Math.min(quota.used, limit);
  const isAtLimit = quota.used >= limit;

  return (
    <span className={className} id={id} aria-live="polite">
      {isAtLimit ? (
        <Text as="span" size="small" tone="subtle">
          You have {formatReadingNumber(limit)} imports. Delete one to free a
          slot.
        </Text>
      ) : (
        <Text as="span" size="small" tone="subtle">
          {formatReadingNumber(used)} of {formatReadingNumber(limit)} import
          slots used
        </Text>
      )}
    </span>
  );
}
