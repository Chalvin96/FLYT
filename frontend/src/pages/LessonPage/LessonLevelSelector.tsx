import { Popover, PopoverContent, PopoverTrigger } from '@flyt/ui';
import { Check, ChevronDown } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import type { LessonLevelOption } from './lessonLevel';

type LessonLevelSelectorProps = {
  options: LessonLevelOption[];
  selectedLevel: string;
  onSelect: (level: string) => void;
};

function deriveNextOptionIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
): number | null {
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return (currentIndex + 1) % optionCount;
  }
  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return (currentIndex - 1 + optionCount) % optionCount;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return optionCount - 1;
  }

  return null;
}

export function LessonLevelSelector({
  options,
  selectedLevel,
  onSelect,
}: LessonLevelSelectorProps) {
  const [open, setOpen] = useState(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedOption =
    options.find((option) => option.level === selectedLevel) ?? options[0];

  if (!selectedOption) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose active course, currently Norwegian ${selectedOption.level}, ${selectedOption.completed} of ${selectedOption.total} lessons completed`}
          className="flex min-h-20 w-full items-center gap-3 radius-section border border-border bg-card px-4 py-3 text-left shadow-soft transition-colors hover:border-secondary-30 hover:bg-secondary-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary-10 type-body font-semibold text-secondary-90">
            {selectedOption.level}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block type-label text-muted-foreground">
              Active course
            </span>
            <span className="mt-0.5 block truncate type-body font-semibold text-foreground">
              Norwegian {selectedOption.level}
            </span>
            <span className="mt-0.5 block type-label text-muted-foreground">
              {selectedOption.completed} of {selectedOption.total} lessons
              completed
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'icon-md shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-[calc(100dvh-2rem)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto p-1.5"
      >
        <div
          aria-label="Choose CEFR level"
          aria-orientation="vertical"
          className="space-y-1"
          role="radiogroup"
        >
          {options.map((option, optionIndex) => {
            const isSelected = option.level === selectedOption.level;
            const completion =
              option.total > 0
                ? Math.round((option.completed / option.total) * 100)
                : 0;

            return (
              <button
                key={option.level}
                type="button"
                role="radio"
                aria-checked={isSelected}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                tabIndex={isSelected ? 0 : -1}
                className={cn(
                  'flex w-full items-start gap-3 radius-field px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'bg-secondary-10 text-foreground'
                    : 'text-foreground hover:bg-secondary-5',
                )}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  const nextIndex = deriveNextOptionIndex(
                    event.key,
                    optionIndex,
                    options.length,
                  );
                  if (nextIndex === null) {
                    return;
                  }

                  event.preventDefault();
                  onSelect(options[nextIndex].level);
                  optionRefs.current[nextIndex]?.focus();
                }}
                onClick={() => {
                  onSelect(option.level);
                  setOpen(false);
                }}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-secondary-70 bg-secondary-70 text-white-100'
                      : 'border-border text-transparent',
                  )}
                >
                  <Check aria-hidden className="icon-sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block type-body font-semibold">
                    Norwegian {option.level}
                  </span>
                  <span className="mt-0.5 block type-label text-muted-foreground">
                    {option.total} lessons · {option.completed} completed
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black-10">
                    <span
                      className="block h-full rounded-full bg-secondary-60 transition-[width]"
                      style={{ width: `${completion}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
