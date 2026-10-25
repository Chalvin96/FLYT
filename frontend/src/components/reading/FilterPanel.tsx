import {
  Badge,
  Button,
  Card,
  DialogDescription,
  DialogTitle,
  Heading,
  Text,
} from '@flyt/ui';

import { formatReadingNumber } from './readingDisplay';

export interface ReadingLevelFilterOption {
  count: number;
  label: string;
  value: string;
}

interface FilterPanelProps {
  levelOptions: ReadingLevelFilterOption[];
  selectedLevels: string[];
  hideReadStories: boolean;
  onToggleLevel: (level: string) => void;
  onHideReadStoriesChange: (value: boolean) => void;
  mode?: 'sidebar' | 'sheet';
  onApply?: () => void;
}

function FilterSections({
  levelOptions,
  selectedLevels,
  hideReadStories,
  onToggleLevel,
  onHideReadStoriesChange,
}: FilterPanelProps) {
  const selectedLevelSet = new Set(selectedLevels);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend>
          <Heading as="span" size="xxsmall">
            Level
          </Heading>
        </legend>
        <div className="mt-3 space-y-1">
          {levelOptions.map((level) => (
            <label
              key={level.value}
              className="flex min-h-11 cursor-pointer items-center gap-3"
            >
              <input
                checked={selectedLevelSet.has(level.value)}
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--background-brand-bold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focused)]"
                onChange={() => onToggleLevel(level.value)}
              />
              <span className="min-w-0 flex-1">
                <Text as="span" size="medium">
                  {level.label}
                </Text>
              </span>{' '}
              <Badge tone="neutral" shape="pill">
                {formatReadingNumber(level.count)}
              </Badge>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="border-t border-default pt-4">
        <legend>
          <Heading as="span" size="xxsmall">
            Status
          </Heading>
        </legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            checked={hideReadStories}
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--background-brand-bold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focused)]"
            onChange={(event) => onHideReadStoriesChange(event.target.checked)}
          />
          <Text as="span" size="medium">
            Hide read stories
          </Text>
        </label>
      </fieldset>
    </div>
  );
}

export function FilterPanel({
  mode = 'sidebar',
  onApply,
  ...props
}: FilterPanelProps) {
  if (mode === 'sheet') {
    return (
      <div className="flex max-h-[var(--sheet-max-height-tall)] flex-col overflow-hidden bg-overlay">
        <div className="border-b border-default px-5 py-4">
          <DialogTitle size="section">Filters</DialogTitle>
          <DialogDescription visuallyHidden>
            Filter stories by level and read status.
          </DialogDescription>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <FilterSections {...props} />
        </div>
        <div className="border-t border-default px-5 py-4">
          <Button type="button" width="full" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="h-fit w-70 shrink-0">
      <Card padding="compact" surface="solid" elevation="flat">
        <FilterSections {...props} />
      </Card>
    </div>
  );
}
