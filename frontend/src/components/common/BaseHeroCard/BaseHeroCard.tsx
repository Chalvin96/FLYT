import { Heading, Text } from '@flyt/ui';
import { m } from 'motion/react';

import { fadeUp } from '@/lib/animations';

import type { BaseHeroCardProps, HeroTone } from './types';

const TONE_CLASSES: Record<HeroTone, string> = {
  brand:
    'bg-[var(--hero-brand-surface)] text-[var(--hero-text)] [--hero-copy:var(--hero-muted-text)]',
  calm: 'bg-[var(--hero-calm-surface)] text-[var(--hero-text)] [--hero-copy:var(--hero-muted-text)]',
  deep: 'bg-[var(--hero-deep-surface)] text-[var(--hero-text)] [--hero-copy:var(--hero-muted-text)]',
  quiet:
    'border border-default bg-neutral text-[var(--hero-quiet-text)] [--hero-copy:var(--hero-quiet-muted-text)]',
};

function getProgressPercentage(current: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  const raw = Math.round((current / total) * 100);
  return Math.max(0, Math.min(100, raw));
}

export function BaseHeroCard({
  tone = 'brand',
  label,
  badge,
  title,
  subtitle,
  decoration,
  details,
  primaryAction,
  secondaryAction,
  chip,
  progress,
}: BaseHeroCardProps) {
  const progressPercentage = progress
    ? getProgressPercentage(progress.current, progress.total)
    : 0;

  return (
    <m.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      data-testid="hero-card"
    >
      <section
        data-testid="hero-card-section"
        className={`radius-section relative overflow-hidden px-4 pb-4 pt-3 shadow-soft ${TONE_CLASSES[tone]}`}
      >
        {decoration}

        <div className="relative flex items-center justify-between gap-3">
          <span className="text-[var(--hero-copy)]">
            <Heading as="span" size="xxsmall">
              {label}
            </Heading>
          </span>
          {badge ? (
            <span className="rounded-full bg-[var(--hero-badge-surface)] px-3 py-1">
              <Heading as="span" size="xxsmall">
                {badge}
              </Heading>
            </span>
          ) : null}
        </div>

        {chip && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-surface)] px-3 py-1">
            {chip.icon}
            <Heading as="span" size="xxsmall">
              {chip.label}
            </Heading>
          </div>
        )}

        <div className="relative mt-3">
          <Heading as="h2" size="xlarge">
            {title}
          </Heading>
          {subtitle !== undefined && (
            <div className="mt-2 text-[var(--hero-copy)]">
              <Text as="p" size="large">
                {subtitle}
              </Text>
            </div>
          )}
        </div>

        {details ? <div className="relative mt-4">{details}</div> : null}

        {progress?.showBar && (
          <div className="relative mt-4">
            <div
              aria-label="Lesson progress"
              aria-valuemax={progress.total}
              aria-valuemin={0}
              aria-valuenow={progress.current}
              className="h-2 w-full rounded-full bg-[var(--hero-progress-track)]"
              role="progressbar"
            >
              <div
                aria-hidden="true"
                data-testid="hero-bar-fill"
                className="h-full w-full rounded-full border border-[var(--progress-border)] bg-progress-primary-complete transition-[clip-path] duration-500"
                style={{
                  clipPath: `inset(0 calc(100% - ${progressPercentage}%) 0 0 round 9999px)`,
                }}
              />
            </div>
            <span className="sr-only">
              {progress.current} of {progress.total} lessons completed
            </span>
            {progress.showPercentage && (
              <div className="mt-2 text-[var(--hero-copy)]">
                <Text as="p" size="medium">
                  {progressPercentage}%
                </Text>
              </div>
            )}
          </div>
        )}

        <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      </section>
    </m.div>
  );
}
