const grades = [
  { interval: '<1 min', label: 'Again' },
  { interval: '2 d', label: 'Hard' },
  { interval: '6 d', label: 'Good' },
  { interval: '14 d', label: 'Easy' },
] as const;

export function ReviewCardPreview() {
  return (
    <div className="radius-section border border-border bg-card p-6 shadow-raised sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-warning-10 px-2.5 py-1 type-label-sm text-warning-70 dark:bg-warning-90/40 dark:text-warning-20">
          From your reading
        </span>
        <span className="type-caption-sm font-semibold text-muted-foreground">
          4 / 12
        </span>
      </div>

      <p className="mt-5 font-display text-[clamp(1.8rem,3.2vw,2.4rem)] font-semibold leading-none tracking-tight">
        regne
      </p>
      <p className="mt-2.5 type-caption text-muted-foreground">
        Utenfor{' '}
        <mark className="radius-sm bg-primary-10 px-1 text-primary-100 dark:bg-primary-90/50 dark:text-primary-20">
          regnet
        </mark>{' '}
        det, men inne var det lunt og stille.
      </p>

      <p className="mt-5 flex flex-wrap items-baseline gap-2 border-t border-dashed border-secondary-30 pt-4 dark:border-white-20">
        <b className="font-display type-section font-semibold">to rain</b>
        <span className="type-caption text-muted-foreground">
          · regner · regnet · har regnet
        </span>
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {grades.map(({ interval, label }) => (
          <span
            className={
              label === 'Good'
                ? 'radius-field border border-primary-40 bg-primary-0 px-1 py-2.5 text-center font-semibold text-primary-100 shadow-commit dark:bg-primary-90/40 dark:text-primary-20'
                : 'radius-field border border-border bg-background px-1 py-2.5 text-center font-semibold text-muted-foreground'
            }
            key={label}
          >
            <span className="block type-caption">{label}</span>
            <small className="block type-caption-sm font-normal opacity-70">
              {interval}
            </small>
          </span>
        ))}
      </div>
    </div>
  );
}

ReviewCardPreview.displayName = 'ReviewCardPreview';
