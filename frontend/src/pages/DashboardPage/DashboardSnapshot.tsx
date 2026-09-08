import { Flame } from 'lucide-react';
import { m } from 'motion/react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
        <div className="shadow-soft radius-section border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="type-body font-semibold text-foreground">
              Practice snapshot
            </p>
            <div className="type-caption flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-medium text-secondary-90">
              <Flame className="icon-sm" strokeWidth={2} />
              <span>{formatNumber(streak)} day streak</span>
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
                      className="type-label-xs w-6 shrink-0 text-center font-medium text-muted-foreground lg:w-8"
                    >
                      {day.short}
                    </span>
                  ))}
                </div>

                {weekRows.map(({ label, values }) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className="type-label-xs w-14 shrink-0 whitespace-nowrap pr-2 text-right font-medium text-muted-foreground">
                      {label}
                    </span>
                    {values.map((value, di) => {
                      const dayLabel = DAY_LABELS[di]?.long ?? '';
                      const reviewText = `${formatNumber(value)} review${value === 1 ? '' : 's'}`;
                      return (
                        <Tooltip key={di}>
                          <TooltipTrigger asChild>
                            <div
                              className={`size-6 shrink-0 cursor-default rounded lg:size-8 ${cellClass(getCellLevel(value))}`}
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
                  <span className="type-caption mr-1 text-muted-foreground">
                    Less
                  </span>
                  {[0, 1, 2, 3, 4, 5].map((level) => (
                    <span
                      key={level}
                      className={`size-3 shrink-0 rounded ${cellClass(level)}`}
                    />
                  ))}
                  <span className="type-caption ml-1 text-muted-foreground">
                    More
                  </span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-border" />

            <div className="flex flex-row justify-around gap-3">
              <div>
                <p className="type-stat font-bold text-foreground">
                  {formatNumber(totalReviews)}
                </p>
                <p className="type-label mt-1 text-muted-foreground">
                  Total reviews
                </p>
              </div>
              <div>
                <p className="type-stat font-bold text-foreground">
                  {formatNumber(streak)}
                </p>
                <p className="type-label mt-1 text-muted-foreground">
                  Day streak
                </p>
              </div>
              <div>
                <p className="type-stat font-bold text-foreground">
                  {formatNumber(peak)}
                </p>
                <p className="type-label mt-1 text-muted-foreground">
                  Max daily
                </p>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </m.section>
  );
}
