import type { ReactNode } from 'react';

import { appCardClassName } from '@/components/common/AppCard/AppCard';
import { cn } from '@/lib/utils';

export function SessionLengthTile({
  title,
  cardsLabel,
  durationLabel,
  isDisabled,
  isSelected,
  icon,
  onClick,
  hint,
}: {
  title: string;
  cardsLabel: string;
  durationLabel: string;
  isDisabled: boolean;
  isSelected: boolean;
  icon: ReactNode;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        appCardClassName,
        'flex min-h-44 cursor-pointer flex-col items-center gap-2 p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected && 'border-primary-60 bg-primary-10',
        !isSelected && !isDisabled && 'hover:bg-muted/40',
        isDisabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {icon}
      <p className="font-display type-section text-foreground">{title}</p>
      <p className="type-caption text-muted-foreground">{cardsLabel}</p>
      <p className="type-caption text-muted-foreground">{durationLabel}</p>
      {hint ? (
        <p className="type-caption font-medium text-warning-70">{hint}</p>
      ) : null}
    </button>
  );
}
