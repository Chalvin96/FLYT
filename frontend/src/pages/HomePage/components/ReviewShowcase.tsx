import { Heading, Text } from '@flyt/ui';
import { Check } from 'lucide-react';

import { ReviewCardPreview } from './ReviewCardPreview';

const points = [
  'FSRS intervals — scheduling that adapts to how you actually recall, not fixed steps.',
  'Nine exercise types per word, scheduled as one concept.',
  'Daily limit on new words, uncapped on reviews. You set the pace.',
] as const;

export function ReviewShowcase() {
  return (
    <section
      className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-16"
      id="review"
    >
      <div>
        <p className="text-success">
          <Heading as="span" size="xxsmall">
            The other half
          </Heading>
        </p>
        <div className="mt-3">
          <Heading as="h2" size="xxlarge" tone="default">
            The word comes back the night before you&rsquo;d forget it.
          </Heading>
        </div>
        <div className="mt-4">
          <Text as="p" size="large" tone="subtle">
            Reading gets words in. Review keeps them. Every card carries the
            sentence you first met it in, so you&rsquo;re recalling a memory
            instead of a flashcard.
          </Text>
        </div>
        <ul className="mt-5 flex flex-col gap-2.5" role="list">
          {points.map((point) => (
            <li className="flex items-start gap-2.5" key={point}>
              <Check className="mt-1.5 shrink-0 text-icon-brand" />
              <Text as="span" size="medium" tone="subtle">
                {point}
              </Text>
            </li>
          ))}
        </ul>
      </div>

      <figure className="m-0">
        <figcaption className="sr-only">
          Illustration of a Flyt review card: the word &ldquo;regne&rdquo;, the
          sentence it was met in, and the four FSRS grades with their intervals.
        </figcaption>
        <ReviewCardPreview />
      </figure>
    </section>
  );
}

ReviewShowcase.displayName = 'ReviewShowcase';
