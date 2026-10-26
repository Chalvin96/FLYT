import { Heading, Text } from '@flyt/ui';
import {
  BarChart3,
  FileText,
  MessageCircle,
  Puzzle,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const features = [
  {
    body: 'Ask for a story anchored to your own deck or the frequency list, and read it immediately. Keep it and it becomes a permanent import; ignore it and it disappears.',
    Icon: Sparkles,
    span: true,
    title: 'Stories generated at your level',
    tone: 'inverse',
  },
  {
    body: 'Look a word up on any Norwegian page and add it without leaving the tab.',
    Icon: Puzzle,
    span: false,
    title: 'Browser extension',
    tone: 'primary',
  },
  {
    body: 'Streak and accuracy from real graded reviews, not minutes spent in an app.',
    Icon: BarChart3,
    span: false,
    title: 'Honest progress',
    tone: 'accent',
  },
  {
    body: 'A tutor chat that knows the sentence you’re stuck on.',
    Icon: MessageCircle,
    span: true,
    title: 'Ask in plain English',
    tone: 'muted',
  },
  {
    body: 'Paste an article, a chapter, or a chat log and it becomes readable and tappable — same lookup, same queue, no reformatting.',
    Icon: FileText,
    span: true,
    title: 'Bring your own text',
    tone: 'primary',
  },
] as const;

const iconTone: Record<string, string> = {
  accent: 'text-success',
  inverse: 'text-inverse',
  muted: 'text-subtle',
  primary: 'text-icon-brand',
  success: 'text-success',
};

export function FeatureGrid() {
  return (
    <section className="scroll-mt-24" id="features">
      <div className="max-w-2xl">
        <p className="text-brand">
          <Heading as="span" size="xxsmall">
            Everything else
          </Heading>
        </p>
        <div className="mt-3">
          <Heading as="h2" size="xxlarge" tone="default">
            Built for the part after &ldquo;hello&rdquo;.
          </Heading>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ body, Icon, span, title, tone }) => {
          const isInverse = tone === 'inverse';

          return (
            <article
              className={`radius-section border p-6 transition-transform hover:-translate-y-1 ${
                isInverse
                  ? 'border-transparent bg-inverse text-inverse sm:col-span-2'
                  : 'border-default bg-raised hover:border-brand-subtle'
              } ${span && !isInverse ? 'sm:col-span-2' : ''}`}
              key={title}
            >
              <span
                className={`grid size-9 place-items-center radius-sm border ${
                  isInverse
                    ? 'border-inverse bg-transparent'
                    : 'border-default bg-neutral'
                }`}
              >
                <Icon className={`icon-md ${iconTone[tone]}`} />
              </span>
              <div className="mt-3">
                <Heading as="h3" size="small">
                  {title}
                </Heading>
              </div>
              <div
                className={cn(
                  'mt-2',
                  isInverse ? 'text-inverse-subtle' : 'text-subtle',
                )}
              >
                <Text as="p" size="medium">
                  {body}
                </Text>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

FeatureGrid.displayName = 'FeatureGrid';
