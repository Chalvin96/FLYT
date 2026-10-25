import {
  Heading,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Row,
  Text,
} from '@flyt/ui';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

import type { LessonLevelOption } from './lessonLevel';

type LessonLevelSelectorProps = {
  options: LessonLevelOption[];
  selectedLevel: string;
  onSelect: (level: string) => void;
};

export function LessonLevelSelector({
  options,
  selectedLevel,
  onSelect,
}: LessonLevelSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.level === selectedLevel) ?? options[0];

  if (!selectedOption) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Row
          aria-label={`Choose active course, currently Norwegian ${selectedOption.level}, ${selectedOption.completed} of ${selectedOption.total} lessons completed`}
          leading={
            <span className="flex size-11 items-center justify-center rounded-full bg-neutral-subtle">
              <Text as="span" size="large" weight="semibold" tone="default">
                {selectedOption.level}
              </Text>
            </span>
          }
          size="md"
          surface="framed"
          trailing={
            <ChevronDown
              aria-hidden
              className="icon-md text-subtle transition-transform group-data-[state=open]:rotate-180"
            />
          }
        >
          <span className="block">
            <Heading as="span" size="xxsmall" tone="subtle">
              Active course
            </Heading>
          </span>
          <span className="mt-0.5 block truncate">
            <Text as="span" size="large" weight="semibold" tone="default">
              Norwegian {selectedOption.level}
            </Text>
          </span>
          <span className="mt-0.5 block">
            <Heading as="span" size="xxsmall" tone="subtle">
              {selectedOption.completed} of {selectedOption.total} lessons
              completed
            </Heading>
          </span>
        </Row>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        padding="compact"
        scroll
        width="trigger"
      >
        <RadioGroup
          aria-label="Choose CEFR level"
          aria-orientation="vertical"
          asChild
          onValueChange={onSelect}
          value={selectedOption.level}
        >
          <div className="space-y-1">
            {options.map((option) => {
              const isSelected = option.level === selectedOption.level;
              const completion =
                option.total > 0
                  ? Math.round((option.completed / option.total) * 100)
                  : 0;

              return (
                <RadioGroupItem asChild key={option.level} value={option.level}>
                  <Row
                    onClick={(event) => {
                      if (event.detail > 0) setOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onSelect(option.level);
                      setOpen(false);
                    }}
                    leading={
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border',
                          isSelected
                            ? 'border-strong-hovered bg-neutral-bold text-inverse'
                            : 'border-default text-transparent',
                        )}
                      >
                        <Check aria-hidden className="icon-sm" />
                      </span>
                    }
                    selected={isSelected}
                    size="sm"
                    surface="plain"
                  >
                    <span className="block">
                      <Text as="span" size="large" weight="semibold">
                        Norwegian {option.level}
                      </Text>
                    </span>
                    <span className="mt-0.5 block">
                      <Heading as="span" size="xxsmall" tone="subtle">
                        {option.total} lessons · {option.completed} completed
                      </Heading>
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-disabled">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-neutral-2)] transition-[width]"
                        style={{ width: `${completion}%` }}
                      />
                    </span>
                  </Row>
                </RadioGroupItem>
              );
            })}
          </div>
        </RadioGroup>
      </PopoverContent>
    </Popover>
  );
}
