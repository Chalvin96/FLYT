import { cn } from '@/lib/utils';

import {
  IMPORT_FILTER_LABELS,
  IMPORT_FILTER_VALUES,
  type ImportFilterValue,
} from './importDisplay';

interface ImportListFiltersProps {
  value: ImportFilterValue;
  onChange: (value: ImportFilterValue) => void;
  className?: string;
}

export function ImportListFilters({
  value,
  onChange,
  className,
}: ImportListFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Filter imports by status"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {IMPORT_FILTER_VALUES.map((filterValue) => {
        const isActive = value === filterValue;
        return (
          <button
            key={filterValue}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(filterValue)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border radius-field px-3 py-1.5 type-caption-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-secondary-90 bg-secondary-90 text-white-100'
                : 'border-border bg-white-100 text-muted-foreground hover:bg-secondary-10 hover:text-foreground',
            )}
          >
            <span>{IMPORT_FILTER_LABELS[filterValue]}</span>
          </button>
        );
      })}
    </div>
  );
}
