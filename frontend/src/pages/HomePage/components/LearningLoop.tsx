import { QueueDiagram } from './QueueDiagram';

const steps = [
  {
    badge: 'Grammar',
    badgeClass:
      'bg-primary-10 text-primary-100 dark:bg-primary-90/40 dark:text-primary-20',
    body: 'Short grammar lessons with drills. Finish one and its vocabulary drops straight into review — no deck-building.',
    label: 'Lessons',
    num: '01',
  },
  {
    badge: 'Lookup',
    badgeClass:
      'bg-warning-10 text-warning-70 dark:bg-warning-90/40 dark:text-warning-20',
    body: 'Curated, generated, or your own imported text. Tap a word for its lemma, gender and inflections — then add it in one press.',
    label: 'Reading',
    num: '02',
  },
  {
    badge: 'FSRS',
    badgeClass:
      'bg-accent-10 text-accent-100 dark:bg-accent-90/40 dark:text-accent-20',
    body: 'One spaced-repetition queue. Cards rotate between recall, build, match, speak and six more shapes, so you never memorise the card.',
    label: 'Review',
    num: '03',
  },
] as const;

export function LearningLoop() {
  return (
    <section className="scroll-mt-24" id="how">
      <div className="max-w-2xl">
        <p className="type-label text-primary-80 dark:text-primary-50">
          The loop
        </p>
        <h2 className="mt-3 font-display type-display-lg font-semibold tracking-tight text-foreground">
          Your grammar app and your flashcard app don&rsquo;t talk. Ours do.
        </h2>
        <p className="mt-4 type-body leading-8 text-muted-foreground sm:type-lead">
          Three places to meet a word. One queue that remembers all of them.
        </p>
      </div>

      <div className="mt-8">
        <QueueDiagram />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {steps.map(({ badge, badgeClass, body, label, num }) => (
          <article
            className="radius-section border border-border bg-card p-6 shadow-soft transition-transform hover:-translate-y-1"
            key={num}
          >
            <span className="font-display type-label-sm font-bold text-muted-foreground">
              {num}
            </span>
            <h3 className="mt-3 flex flex-wrap items-center gap-2 font-display type-title font-semibold tracking-tight">
              {label}
              <span
                className={`rounded-full px-2.5 py-0.5 type-label-xs ${badgeClass}`}
              >
                {badge}
              </span>
            </h3>
            <p className="mt-2.5 type-caption leading-7 text-muted-foreground">
              {body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

LearningLoop.displayName = 'LearningLoop';
