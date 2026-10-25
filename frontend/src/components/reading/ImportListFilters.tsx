import { Chip } from '@flyt/ui';

import { cn } from '@/lib/utils';

import {
  IMPORT_FILTER_LABELS,
  IMPORT_FILTER_VALUES,
  type ImportFilterValue,
} from './importDisplay';
import { formatReadingNumber } from './readingDisplay';

interface ImportListFiltersProps {
  value: ImportFilterValue;
  onChange: (value: ImportFilterValue) => void;
  className?: string;
  counts: Record<ImportFilterValue, number>;
}

export function ImportListFilters({
  value,
  onChange,
  className,
  counts,
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
          <Chip
            key={filterValue}
            onClick={() => onChange(filterValue)}
            pressed={isActive}
          >
            {IMPORT_FILTER_LABELS[filterValue]}{' '}
            {formatReadingNumber(counts[filterValue])}
          </Chip>
        );
      })}
    </div>
  );
}
