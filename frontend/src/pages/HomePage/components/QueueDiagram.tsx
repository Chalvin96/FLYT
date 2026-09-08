import { ArrowDown, BookOpen, Download, GraduationCap } from 'lucide-react';

const sources = [
  {
    Icon: GraduationCap,
    caption: 'grammar you were taught',
    label: 'Lessons',
    tint: 'bg-primary-10 text-primary-80',
  },
  {
    Icon: BookOpen,
    caption: 'words you tapped',
    label: 'Reading',
    tint: 'bg-warning-10 text-warning-70',
  },
  {
    Icon: Download,
    caption: 'text you brought yourself',
    label: 'Imports',
    tint: 'bg-accent-10 text-accent-90',
  },
] as const;

const mix = [
  { color: 'bg-primary-70', label: 'Lessons', width: '42%' },
  { color: 'bg-warning-40', label: 'Reading', width: '34%' },
  { color: 'bg-accent-50', label: 'Imports', width: '16%' },
] as const;

export function QueueDiagram() {
  return (
    <div className="radius-section border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_8.25rem_minmax(0,1.05fr)] lg:gap-0">
        <ul className="flex flex-col gap-3" role="list">
          {sources.map(({ caption, Icon, label, tint }) => (
            <li
              className="flex items-center gap-3 radius-field border border-border bg-background px-4 py-3"
              key={label}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center radius-sm ${tint}`}
              >
                <Icon className="icon-md" />
              </span>
              <span>
                <b className="block font-display type-caption font-semibold">
                  {label}
                </b>
                <small className="type-caption-sm text-muted-foreground">
                  {caption}
                </small>
              </span>
            </li>
          ))}
        </ul>

        <svg
          aria-hidden
          className="hidden h-56 w-33 lg:block"
          fill="none"
          viewBox="0 0 132 230"
        >
          <path
            d="M2 40C60 40 60 115 130 115"
            stroke="var(--primary-40)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M2 115H130"
            stroke="var(--warning-30)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M2 190C60 190 60 115 130 115"
            stroke="var(--accent-40)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <circle cx="130" cy="115" fill="var(--primary-70)" r="5" />
        </svg>
        <ArrowDown
          aria-hidden
          className="mx-auto icon-lg text-secondary-40 lg:hidden"
        />

        <div className="radius-section border border-primary-30 bg-primary-0 p-5 dark:border-primary-80 dark:bg-primary-90/25">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display type-section font-semibold tracking-tight">
              One review queue
            </h3>
            <span className="font-display type-title font-bold tracking-tight text-primary-80">
              12
            </span>
          </div>
          <div className="mt-3.5 flex h-2.5 gap-1 overflow-hidden rounded-full bg-muted">
            {mix.map(({ color, label, width }) => (
              <span
                className={`block rounded-full ${color}`}
                key={label}
                style={{ width }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" role="list">
            {mix.map(({ color, label }) => (
              <li
                className="flex items-center gap-2 type-caption-sm text-muted-foreground"
                key={label}
              >
                <span className={`size-2 rounded-full ${color}`} />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-3.5 border-t border-border pt-3.5 type-caption leading-6 text-muted-foreground">
            FSRS schedules each word once — whichever surface you met it on.
            Learn it in a lesson, meet it again in a story, and it doesn&rsquo;t
            turn into two cards.
          </p>
        </div>
      </div>
    </div>
  );
}

QueueDiagram.displayName = 'QueueDiagram';
