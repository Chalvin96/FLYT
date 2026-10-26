import {
  Heading,
  Text,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@flyt/ui';
import { Flame } from 'lucide-react';
import { m } from 'motion/react';

import { formatNumber } from '@/lib/utils';

import { cellClass, DAY_LABELS, fadeUp, getCellLevel } from './constants';

type Snapshot = {
  this_week: number[];
  last_week: number[];
  two_weeks_ago: number[];
  three_weeks_ago: number[];
};

type Props = {
  practiceSnapshot: Snapshot;
  streak: number;
};

export function DashboardSnapshot({ practiceSnapshot, streak }: Props) {
  const weekRows = [
    { label: '3w ago', values: practiceSnapshot.three_weeks_ago },
    { label: '2w ago', values: practiceSnapshot.two_weeks_ago },
    { label: 'Last wk', values: practiceSnapshot.last_week },
    { label: 'This wk', values: practiceSnapshot.this_week },
  ];
  const totalReviews = weekRows.reduce(
    (sum, row) => sum + row.values.reduce((s, v) => s + v, 0),
    0,
  );
  const peak = Math.max(0, ...weekRows.flatMap((row) => row.values));
  return (
    <m.section variants={fadeUp}>
      <TooltipProvider delayDuration={150}>
        <div className="shadow-soft radius-section border border-default bg-raised p-4">
          <div className="flex items-center justify-between gap-3">
            <Heading as="div" size="small" tone="default">
              Practice snapshot
            </Heading>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-default bg-neutral-subtle px-3 py-1 text-default">
              <Flame className="icon-sm" strokeWidth={2} />
              <Text as="span" size="medium" weight="semibold">
                {formatNumber(streak)} day streak
              </Text>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="text-center">
              <div className="inline-flex flex-col gap-1 pr-14">
                <div className="flex gap-1">
                  <div className="w-14 shrink-0" aria-hidden="true" />
                  {DAY_LABELS.map((day) => (
                    <span
                      key={day.long}
                      className="w-6 shrink-0 text-center lg:w-8"
                    >
                      <Heading as="span" size="xxsmall" tone="subtle">
                        {day.short}
                      </Heading>
                    </span>
                  ))}
                </div>

                {weekRows.map(({ label, values }) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className="w-14 shrink-0 whitespace-nowrap pr-2 text-right">
                      <Heading as="span" size="xxsmall" tone="subtle">
                        {label}
                      </Heading>
                    </span>
                    {values.map((value, di) => {
                      const dayLabel = DAY_LABELS[di]?.long ?? '';
                      const reviewText = `${formatNumber(value)} review${value === 1 ? '' : 's'}`;
                      return (
                        <Tooltip key={di}>
                          <TooltipTrigger asChild>
                            <div
                              className={`size-6 shrink-0 cursor-default rounded-sm lg:size-8 ${cellClass(getCellLevel(value))}`}
                              aria-label={`${label}, ${dayLabel}: ${reviewText}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {`${dayLabel} · ${reviewText}`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}

                <div className="mt-1 flex items-center gap-1 pl-14">
                  <span className="mr-1">
                    <Text as="span" size="medium" tone="subtle">
                      Less
                    </Text>
                  </span>
                  {[0, 1, 2, 3, 4, 5].map((level) => (
                    <span
                      key={level}
                      className={`size-3 shrink-0 rounded-sm ${cellClass(level)}`}
                    />
                  ))}
                  <span className="ml-1">
                    <Text as="span" size="medium" tone="subtle">
                      More
                    </Text>
                  </span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-neutral-pressed" />

            <div className="flex flex-row justify-around gap-3">
              <div>
                <Heading as="div" size="large" tone="default">
                  {formatNumber(totalReviews)}
                </Heading>
                <p className="mt-1">
                  <Heading as="span" size="xxsmall" tone="subtle">
                    Total reviews
                  </Heading>
                </p>
              </div>
              <div>
                <Heading as="div" size="large" tone="default">
                  {formatNumber(streak)}
                </Heading>
                <p className="mt-1">
                  <Heading as="span" size="xxsmall" tone="subtle">
                    Day streak
                  </Heading>
                </p>
              </div>
              <div>
                <Heading as="div" size="large" tone="default">
                  {formatNumber(peak)}
                </Heading>
                <p className="mt-1">
                  <Heading as="span" size="xxsmall" tone="subtle">
                    Max daily
                  </Heading>
                </p>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </m.section>
  );
}
