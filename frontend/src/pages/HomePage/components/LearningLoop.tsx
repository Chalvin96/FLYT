import { Heading, Text } from '@flyt/ui';

import { cn } from '@/lib/utils';

import { QueueDiagram } from './QueueDiagram';

const steps = [
  {
    badge: 'Grammar',
    badgeClass: 'bg-brand-subtle text-selected',
    body: 'Short grammar lessons with drills. Finish one and its vocabulary drops straight into review — no deck-building.',
    label: 'Lessons',
    num: '01',
  },
  {
    badge: 'Lookup',
    badgeClass: 'bg-neutral-subtle text-default',
    body: 'Curated, generated, or your own imported text. Tap a word for its lemma, gender and inflections — then add it in one press.',
    label: 'Reading',
    num: '02',
  },
  {
    badge: 'FSRS',
    badgeClass: 'bg-success-subtle text-success',
    body: 'One spaced-repetition queue. Cards rotate between recall, build, match, write and five more shapes, so you never memorise the card.',
    label: 'Review',
    num: '03',
  },
] as const;

export function LearningLoop() {
  return (
    <section className="scroll-mt-24" id="how">
      <div className="max-w-2xl">
        <Heading as="div" size="xxsmall" tone="brand">
          The loop
        </Heading>
        <div className="mt-3">
          <Heading as="h2" size="xxlarge">
            Your grammar app and your flashcard app don&rsquo;t talk. Ours do.
          </Heading>
        </div>
        <div className="mt-4">
          <Text as="p" size="large" smSize="xl" tone="subtle">
            Three places to meet a word. One queue that remembers all of them.
          </Text>
        </div>
      </div>

      <div className="mt-8">
        <QueueDiagram />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {steps.map(({ badge, badgeClass, body, label, num }) => (
          <article
            className="radius-section border border-default bg-raised p-6 shadow-soft transition-transform hover:-translate-y-1"
            key={num}
          >
            <Heading as="span" size="xxsmall" tone="subtle">
              {num}
            </Heading>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Heading as="h3" size="large">
                {label}
              </Heading>
              <span className={cn('rounded-full px-2.5 py-0.5', badgeClass)}>
                <Heading as="span" size="xxsmall">
                  {badge}
                </Heading>
              </span>
            </div>
            <div className="mt-2.5">
              <Text as="p" size="medium" tone="subtle">
                {body}
              </Text>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

LearningLoop.displayName = 'LearningLoop';
