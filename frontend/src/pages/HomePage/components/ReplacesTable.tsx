import { Heading, Text } from '@flyt/ui';
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
    <section className="radius-section overflow-hidden border border-default bg-raised">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-default px-6 py-5 sm:px-7">
        <Heading as="h2" size="large">
          What it replaces
        </Heading>
        <Text size="medium" tone="subtle">
          Three vocabularies, none of which know about the others.
        </Text>
      </div>

      <div className="grid sm:grid-cols-3">
        {replaced.map(({ body, kind, name }) => (
          <div
            className="border-b border-default px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-7"
            key={kind}
          >
            <Heading as="div" size="xxsmall" tone="subtle">
              {kind}
            </Heading>
            <h3 className="mt-2 line-through decoration-[var(--border-danger)] decoration-2">
              <Heading as="span" size="small" tone="subtle">
                {name}
              </Heading>
            </h3>
            <div className="mt-2">
              <Text as="p" size="medium" tone="subtle">
                {body}
              </Text>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-inverse px-6 py-5 sm:px-7">
        <p className="flex items-center gap-2.5 text-inverse">
          <Check className="shrink-0 text-[var(--chart-success)]" />
          <Heading as="span" size="medium" tone="inverse">
            Flyt is all three, wired together
          </Heading>
        </p>
        <div className="text-inverse-subtle">
          <Text as="p" size="medium">
            One account, one queue, one place your Norwegian lives.
          </Text>
        </div>
      </div>
    </section>
  );
}

ReplacesTable.displayName = 'ReplacesTable';
