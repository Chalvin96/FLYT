import type { ImportQuota } from '@/types/api';

interface ImportQuotaBadgeProps {
  quota: ImportQuota | undefined;
  className?: string;
}

export function ImportQuotaBadge({ quota, className }: ImportQuotaBadgeProps) {
  if (!quota) {
    return null;
  }
  const limit = quota.limit;
  const used = Math.min(quota.used, limit);
  const isAtLimit = quota.used >= limit;

  return (
    <span
      className={className ?? 'type-caption-sm text-muted-foreground'}
      aria-live="polite"
    >
      {isAtLimit ? (
        <span className="text-warning-100">
          {used}/{limit} imports — limit reached
        </span>
      ) : (
        <span>
          {used}/{limit} imports
        </span>
      )}
    </span>
  );
}
