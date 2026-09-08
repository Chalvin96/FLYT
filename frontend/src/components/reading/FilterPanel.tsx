import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
  mode,
}: FilterPanelProps) {
  const isSheet = mode === 'sheet';
  const checkboxClassName = isSheet ? 'h-5 w-5' : 'h-[18px] w-[18px]';
  const optionClassName = isSheet
    ? 'radius-field px-2 py-2 type-body'
    : 'type-body';
  const selectedLevelSet = new Set(selectedLevels);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="type-label font-semibold text-foreground">Level</h2>
        <div className="mt-4 space-y-2.5">
          {levelOptions.map((level) => (
            <label
              key={level.value}
              className={cn(
                'flex items-center justify-between gap-3 text-foreground',
                optionClassName,
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  checked={selectedLevelSet.has(level.value)}
                  type="checkbox"
                  className={cn(
                    'rounded border-border text-primary-70 focus:ring-primary-60',
                    checkboxClassName,
                  )}
                  onChange={() => onToggleLevel(level.value)}
                />
                <span>{level.label}</span>
              </span>
              <span className="rounded-full bg-secondary-10 px-2.5 py-1 type-caption font-semibold text-secondary-90">
                {level.count}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="type-label font-semibold text-foreground">Status</h2>
        <label
          className={cn(
            'mt-4 flex items-center gap-3 text-foreground',
            optionClassName,
          )}
        >
          <input
            checked={hideReadStories}
            type="checkbox"
            className={cn(
              'rounded border-border text-primary-70 focus:ring-primary-60',
              checkboxClassName,
            )}
            onChange={(event) => onHideReadStoriesChange(event.target.checked)}
          />
          Hide read stories
        </label>
      </section>
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
      <div className="flex max-h-[var(--sheet-max-height-tall)] flex-col overflow-hidden">
        <div className="flex justify-center px-5 pt-3">
          <span className="h-1 w-10 rounded-full bg-secondary-30" />
        </div>

        <div className="border-b border-border px-5 pb-4 pt-4">
          <DialogTitle className="text-left type-section font-semibold text-foreground">
            Filters
          </DialogTitle>
          <DialogDescription className="sr-only">
            Filter stories by level and read status.
          </DialogDescription>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <FilterSections {...props} mode={mode} />
        </div>

        <div className="border-t border-border px-5 py-4">
          <Button type="button" className="w-full" onClick={onApply}>
            Apply
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppCard className="h-fit w-[260px] shrink-0 border-border bg-white-100 p-5 lg:sticky lg:top-4">
      <FilterSections {...props} mode={mode} />
    </AppCard>
  );
}
