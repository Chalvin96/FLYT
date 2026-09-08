import { motion } from 'motion/react';

import { fadeUp } from '@/lib/animations';

import type { BaseHeroCardProps } from './types';

function getProgressPercentage(current: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  const raw = Math.round((current / total) * 100);
  return Math.max(0, Math.min(100, raw));
}

export function BaseHeroCard({
  className,
  label,
  labelClass,
  badge,
  badgeClass,
  title,
  subtitle,
  subtitleClass,
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
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      data-testid="hero-card"
    >
      <section
        data-testid="hero-card-section"
        className={`radius-section relative overflow-hidden px-4 pb-4 pt-3 shadow-soft ${className}`}
      >
        {decoration}

        <div className="relative flex items-center justify-between gap-3">
          <span className={`type-label ${labelClass}`}>{label}</span>
          <span className={`type-label rounded-full px-3 py-1 ${badgeClass}`}>
            {badge}
          </span>
        </div>

        {chip && (
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 ${chip.className ?? ''}`}
          >
            {chip.icon}
            <span className="type-label">{chip.label}</span>
          </div>
        )}

        <div className="relative mt-3">
          <h2 className="type-hero leading-snug">{title}</h2>
          <p className={`mt-2 type-body ${subtitleClass}`}>{subtitle}</p>
        </div>

        {details ? <div className="relative mt-4">{details}</div> : null}

        {progress?.showBar && (
          <div className="relative mt-4">
            <div
              aria-label="Lesson progress"
              aria-valuemax={progress.total}
              aria-valuemin={0}
              aria-valuenow={progress.current}
              className="h-2 w-full rounded-full bg-black-10"
              role="progressbar"
            >
              <div
                aria-hidden="true"
                data-testid="hero-bar-fill"
                className="h-full origin-left rounded-full bg-white-100 transition-transform duration-500"
                style={{ transform: `scaleX(${progressPercentage / 100})` }}
              />
            </div>
            <span className="sr-only">
              {progress.current} of {progress.total} lessons completed
            </span>
            {progress.showPercentage && (
              <p className="mt-2 type-caption text-white-70">
                {progressPercentage}%
              </p>
            )}
          </div>
        )}

        <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      </section>
    </motion.div>
  );
}
