import { Heading, Text } from '@flyt/ui';
import { ArrowDown, BookOpen, Download, GraduationCap } from 'lucide-react';

const sources = [
  {
    Icon: GraduationCap,
    caption: 'grammar you were taught',
    label: 'Lessons',
    tint: 'bg-brand-subtle text-selected',
  },
  {
    Icon: BookOpen,
    caption: 'words you tapped',
    label: 'Reading',
    tint: 'bg-neutral-subtle text-icon-default',
  },
  {
    Icon: Download,
    caption: 'text you brought yourself',
    label: 'Imports',
    tint: 'bg-success-subtle text-success',
  },
] as const;

const mix = [
  { color: 'bg-brand-bold', label: 'Lessons', width: '42%' },
  { color: 'bg-[var(--chart-neutral-2)]', label: 'Reading', width: '34%' },
  { color: 'bg-[var(--chart-success)]', label: 'Imports', width: '16%' },
] as const;

export function QueueDiagram() {
  return (
    <div className="radius-section border border-default bg-raised p-6 shadow-soft sm:p-8">
      <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_8.25rem_minmax(0,1.05fr)] lg:gap-0">
        <ul className="flex flex-col gap-3" role="list">
          {sources.map(({ caption, Icon, label, tint }) => (
            <li
              className="flex items-center gap-3 radius-field border border-default bg-neutral px-4 py-3"
              key={label}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center radius-sm ${tint}`}
              >
                <Icon className="icon-md" />
              </span>
              <div>
                <Text as="div" size="medium" weight="semibold">
                  {label}
                </Text>
                <Text as="div" size="small" tone="subtle">
                  {caption}
                </Text>
              </div>
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
            stroke="var(--border-brand-subtle)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M2 115H130"
            stroke="var(--border-strong)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <path
            d="M2 190C60 190 60 115 130 115"
            stroke="var(--border-success-subtle)"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <circle cx="130" cy="115" fill="var(--icon-brand)" r="5" />
        </svg>
        <ArrowDown
          aria-hidden
          className="mx-auto icon-lg text-icon-default lg:hidden"
        />

        <div className="radius-section border border-brand-subtle bg-brand-subtle p-5">
          <div className="flex items-center justify-between gap-3">
            <Heading as="h3" size="medium">
              One review queue
            </Heading>
            <Heading as="span" size="large" tone="selected">
              12
            </Heading>
          </div>
          <div className="mt-3.5 flex h-2.5 gap-1 overflow-hidden rounded-full bg-neutral-subtle">
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
              <li className="flex items-center gap-2" key={label}>
                <span className={`size-2 rounded-full ${color}`} />
                <Text as="span" size="small" tone="default">
                  {label}
                </Text>
              </li>
            ))}
          </ul>
          <div className="mt-3.5 border-t border-default pt-3.5">
            <Text as="p" size="medium" tone="default">
              FSRS schedules each word once — whichever surface you met it on.
              Learn it in a lesson, meet it again in a story, and it
              doesn&rsquo;t turn into two cards.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

QueueDiagram.displayName = 'QueueDiagram';
