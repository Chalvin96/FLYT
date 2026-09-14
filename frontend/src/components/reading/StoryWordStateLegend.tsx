import { cn } from '@/lib/utils';

const WORD_STATES = [
  ['bg-warning-50', 'New'],
  ['bg-primary-40', 'Learning'],
] as const;

export function StoryWordStateLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 type-caption-sm text-muted-foreground',
        className,
      )}
    >
      {WORD_STATES.map(([color, label]) => (
        <span className="flex items-center gap-1.5" key={label}>
          <span className={cn('inline-block h-0.5 w-4 rounded-full', color)} />
          {label}
        </span>
      ))}
    </div>
  );
}
