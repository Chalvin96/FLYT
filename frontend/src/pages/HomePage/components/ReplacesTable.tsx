import { Check } from 'lucide-react';

const replaced = [
  {
    body: 'Teaches you words, then never shows them to you in anything you’d actually read.',
    kind: 'Grammar app',
    name: 'Duolingo, a textbook',
  },
  {
    body: 'You look a word up, understand the sentence, and forget it by Thursday.',
    kind: 'Reader',
    name: 'A PDF and a dictionary tab',
  },
  {
    body: 'Works — if you’re willing to spend the evening making cards instead of learning.',
    kind: 'Flashcards',
    name: 'Anki, hand-built decks',
  },
] as const;

export function ReplacesTable() {
  return (
    <section className="radius-section overflow-hidden border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-5 sm:px-7">
        <h2 className="font-display type-title font-semibold tracking-tight">
          What it replaces
        </h2>
        <p className="type-caption text-muted-foreground">
          Three vocabularies, none of which know about the others.
        </p>
      </div>

      <div className="grid sm:grid-cols-3">
        {replaced.map(({ body, kind, name }) => (
          <div
            className="border-b border-border px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-7"
            key={kind}
          >
            <p className="type-label-sm text-muted-foreground">{kind}</p>
            <h3 className="mt-2 font-display type-body font-semibold text-muted-foreground line-through decoration-destructive-50 decoration-2">
              {name}
            </h3>
            <p className="mt-2 type-caption leading-6 text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary-100 px-6 py-5 dark:bg-secondary-90 sm:px-7">
        <p className="flex items-center gap-2.5 font-display type-section font-semibold text-white-100">
          <Check className="shrink-0 text-accent-30" />
          Flyt is all three, wired together
        </p>
        <p className="type-caption text-white-70">
          One account, one queue, one place your Norwegian lives.
        </p>
      </div>
    </section>
  );
}

ReplacesTable.displayName = 'ReplacesTable';
