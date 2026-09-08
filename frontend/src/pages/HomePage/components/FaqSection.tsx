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
      <h2 className="font-display type-display-lg font-semibold tracking-tight text-foreground">
        Questions
      </h2>
      <div className="mt-6 max-w-3xl border-t border-border">
        {questions.map(({ answer, question }, index) => (
          <details
            className="group border-b border-border"
            key={question}
            open={index === 0}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 font-display type-body font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              {question}
              <span
                aria-hidden
                className="type-title font-normal text-muted-foreground group-open:hidden"
              >
                +
              </span>
              <span
                aria-hidden
                className="hidden type-title font-normal text-muted-foreground group-open:inline"
              >
                &ndash;
              </span>
            </summary>
            <p className="max-w-[70ch] pb-5 type-caption leading-7 text-muted-foreground">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

FaqSection.displayName = 'FaqSection';
