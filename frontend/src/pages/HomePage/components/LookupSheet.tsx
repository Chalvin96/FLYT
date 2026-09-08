import { Plus } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';

const forms = ['regner', 'regnet', 'har regnet'] as const;

export function LookupSheet() {
  return (
    <div className="radius-section border border-border bg-popover p-4 shadow-raised">
      <div className="flex items-baseline gap-2">
        <p className="font-display type-title font-semibold tracking-tight">
          regne
        </p>
        <span className="radius-sm bg-muted px-1.5 py-0.5 type-label-xs text-muted-foreground">
          verb
        </span>
      </div>
      <p className="mt-1.5 type-caption text-muted-foreground">
        to rain — <i>det regner</i>, it is raining
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {forms.map((form) => (
          <span
            className="radius-sm border border-border bg-background px-2 py-0.5 type-caption-sm text-muted-foreground"
            key={form}
          >
            {form}
          </span>
        ))}
      </div>
      <Button asChild className="mt-3.5 w-full cursor-default" size="sm">
        <span>
          <Plus />
          Add to review
        </span>
      </Button>
    </div>
  );
}

LookupSheet.displayName = 'LookupSheet';
