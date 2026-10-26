import { Glyph, Heading, Text } from '@flyt/ui';

const questions = [
  {
    answer:
      'No. Lessons and reading create cards as you go. You can start reading a story two minutes after signing up and never open a deck editor.',
    question: 'Do I need to build a deck first?',
  },
  {
    answer:
      'Nothing. There is no paid tier, no trial that expires, and no card on file. You need an account so your queue follows you between devices — that is it.',
    question: 'What does it cost?',
  },
  {
    answer:
      'It is for the stage after a beginner app runs out — when you can read a little but the words will not stick. Grammar, real text, and spaced repetition in one place.',
    question: 'Is this a Duolingo replacement?',
  },
  {
    answer:
      'Bokmål. Definitions and inflections come from Ordbokene, so the word data is the same source Norwegians use.',
    question: 'Bokmål or Nynorsk?',
  },
  {
    answer:
      'Yes — paste any Norwegian text, or use the browser extension to look words up on the page you are already on. Both feed the same review queue.',
    question: 'Can I bring my own reading?',
  },
] as const;

export function FaqSection() {
  return (
    <section className="scroll-mt-24" id="faq">
      <Heading as="h2" size="xxlarge" tone="default">
        Questions
      </Heading>
      <div className="mt-6 max-w-3xl border-t border-default">
        {questions.map(({ answer, question }, index) => (
          <details
            className="group border-b border-default"
            key={question}
            open={index === 0}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 marker:content-none [&::-webkit-details-marker]:hidden">
              <Text as="span" size="large" weight="semibold">
                {question}
              </Text>
              <span aria-hidden className="text-subtle group-open:hidden">
                <Glyph>+</Glyph>
              </span>
              <span
                aria-hidden
                className="hidden text-subtle group-open:inline"
              >
                <Glyph>&ndash;</Glyph>
              </span>
            </summary>
            <div className="max-w-[70ch] pb-5">
              <Text as="p" size="medium" tone="subtle">
                {answer}
              </Text>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

FaqSection.displayName = 'FaqSection';
