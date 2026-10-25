import { Text } from '@flyt/ui';

import { cn } from '@/lib/utils';

export function StoryWordStateLegend({
  className,
  counts,
}: {
  className?: string;
  counts?: { new: number; learning: number };
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}
      role="group"
      aria-label="Word states"
    >
      {(!counts || counts.new > 0) && (
        <Text as="span" size="small" tone="subtle">
          <span className="word-underline-new">New</span>
          {counts ? ` ${counts.new}` : ''}
        </Text>
      )}
      {(!counts || counts.learning > 0) && (
        <Text as="span" size="small" tone="subtle">
          <span className="word-underline-learning">Learning</span>
          {counts ? ` ${counts.learning}` : ''}
        </Text>
      )}
    </div>
  );
}
