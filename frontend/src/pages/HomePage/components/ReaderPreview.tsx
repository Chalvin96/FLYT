const tabs = ['Lessons', 'Reading', 'Review'] as const;

export function ReaderPreview() {
  return (
    <div className="radius-section border border-border bg-card shadow-raised">
      <div className="flex items-center gap-2 rounded-t-[calc(var(--radius-section)-1px)] border-b border-border bg-gradient-to-b from-background to-card px-4 py-3">
        {[0, 1, 2].map((dot) => (
          <span className="size-2 rounded-full bg-border" key={dot} />
        ))}
        <div className="ml-3 flex gap-1">
          {tabs.map((tab) => (
            <span
              className={
                tab === 'Reading'
                  ? 'radius-sm bg-primary-10 px-3 py-1 type-caption-sm font-semibold text-primary-100'
                  : 'radius-sm px-3 py-1 type-caption-sm font-semibold text-muted-foreground'
              }
              key={tab}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      <div className="relative px-6 pb-20 pt-6 sm:pb-24">
        <p className="type-label-sm text-muted-foreground">Story · Level A2</p>
        <p className="mt-1.5 font-display type-section font-semibold">
          Kaffe på Grünerløkka
        </p>
        <p className="mt-3.5 max-w-[30ch] type-body leading-[2.05] text-foreground">
          Hun{' '}
          <span className="rounded-sm bg-muted px-0.5 dark:bg-white-10">
            bestilte
          </span>{' '}
          en kopp kaffe og satte seg ved{' '}
          <span className="word-underline-new">vinduet</span>. Utenfor{' '}
          <span className="radius-sm bg-primary-70 px-1 py-0.5 text-white-100 shadow-commit">
            regnet
          </span>{' '}
          det, men inne var det <span className="word-underline-new">lunt</span>{' '}
          og stille.
        </p>
      </div>
    </div>
  );
}

ReaderPreview.displayName = 'ReaderPreview';
