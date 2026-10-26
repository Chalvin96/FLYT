import { Button, Heading, Text } from '@flyt/ui';
import { Plus } from 'lucide-react';

const forms = ['regner', 'regnet', 'har regnet'] as const;

export function LookupSheet() {
  return (
    <div className="radius-section border border-default bg-overlay p-4 shadow-raised">
      <div className="flex items-baseline gap-2">
        <Heading as="div" size="large" tone="default">
          regne
        </Heading>
        <span className="radius-sm bg-neutral-subtle px-1.5 py-0.5 text-subtle">
          <Heading as="span" size="xxsmall">
            Verb
          </Heading>
        </span>
      </div>
      <div className="mt-1.5">
        <Text as="p" size="medium" tone="subtle">
          to rain — <i>det regner</i>, it is raining
        </Text>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {forms.map((form) => (
          <span
            className="radius-sm border border-default bg-neutral px-2 py-0.5"
            key={form}
          >
            <Text as="span" size="small" tone="subtle">
              {form}
            </Text>
          </span>
        ))}
      </div>
      <div className="mt-3.5 [&>span]:cursor-default">
        <Button asChild size="sm" width="full">
          <span>
            <Plus />
            Add to review
          </span>
        </Button>
      </div>
    </div>
  );
}

LookupSheet.displayName = 'LookupSheet';
