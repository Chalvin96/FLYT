import { Button, Heading, Text } from '@flyt/ui';
import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function ClosingSection() {
  return (
    <section className="radius-section relative overflow-hidden bg-[var(--hero-brand-surface)] px-6 py-10 text-[var(--hero-text)] sm:px-10 sm:py-14">
      <div className="relative z-10 max-w-2xl">
        <Heading as="div" size="xxsmall">
          Ready to start?
        </Heading>
        <div className="mt-3">
          <Heading as="h2" size="xxlarge">
            Read a Norwegian story tonight.
          </Heading>
        </div>
        <div className="mt-4 text-[var(--hero-muted-text)]">
          <Text as="p" size="large">
            No deck to build. Tap any word you don&rsquo;t know and add it
            straight to review.
          </Text>
        </div>
        <div className="mt-7">
          <Button asChild variant="primary">
            <Link to="/login">
              Read your first story
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

ClosingSection.displayName = 'ClosingSection';
