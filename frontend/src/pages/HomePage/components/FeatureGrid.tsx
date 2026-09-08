import {
  BarChart3,
  FileText,
  MessageCircle,
  Mic,
  Puzzle,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    body: 'Ask for a story anchored to your own deck or the frequency list, and read it immediately. Keep it and it becomes a permanent import; ignore it and it disappears.',
    Icon: Sparkles,
    span: true,
    title: 'Stories generated at your level',
    tone: 'dark',
  },
  {
    body: 'Look a word up on any Norwegian page and add it without leaving the tab.',
    Icon: Puzzle,
    span: false,
    title: 'Browser extension',
    tone: 'primary',
  },
  {
    body: 'Speak the answer and have it transcribed, instead of only reading it.',
    Icon: Mic,
    span: false,
    title: 'Say it out loud',
    tone: 'warning',
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
    span: false,
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
  accent: 'text-accent-70',
  dark: 'text-white-100',
  muted: 'text-muted-foreground',
  primary: 'text-primary-70',
  warning: 'text-warning-60',
};

export function FeatureGrid() {
  return (
    <section className="scroll-mt-24" id="features">
      <div className="max-w-2xl">
        <p className="type-label text-warning-70 dark:text-warning-30">
          Everything else
        </p>
        <h2 className="mt-3 font-display type-display-lg font-semibold tracking-tight text-foreground">
          Built for the part after &ldquo;hello&rdquo;.
        </h2>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ body, Icon, span, title, tone }) => {
          const isDark = tone === 'dark';

          return (
            <article
              className={`radius-section border p-6 transition-transform hover:-translate-y-1 ${
                isDark
                  ? 'border-transparent bg-secondary-100 text-white-100 dark:bg-secondary-90 sm:col-span-2'
                  : 'border-border bg-card hover:border-primary-40'
              } ${span && !isDark ? 'sm:col-span-2' : ''}`}
              key={title}
            >
              <span
                className={`grid size-9 place-items-center radius-sm border ${
                  isDark
                    ? 'border-white-20 bg-white-10'
                    : 'border-border bg-background'
                }`}
              >
                <Icon className={`icon-md ${iconTone[tone]}`} />
              </span>
              <h3 className="mt-3 font-display type-body font-semibold tracking-tight">
                {title}
              </h3>
              <p
                className={`mt-2 type-caption leading-6 ${
                  isDark ? 'text-white-70' : 'text-muted-foreground'
                }`}
              >
                {body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

FeatureGrid.displayName = 'FeatureGrid';
