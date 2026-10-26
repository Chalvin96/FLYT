import { Button, Heading, Text } from '@flyt/ui';
import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { LookupSheet } from './LookupSheet';
import { ReaderPreview } from './ReaderPreview';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-1/5 -top-2/5 h-[120%] bg-[radial-gradient(46%_40%_at_22%_18%,var(--background-selected-hovered),transparent_70%),radial-gradient(40%_36%_at_82%_8%,var(--background-neutral-pressed),transparent_68%)] opacity-70"
      />
      <div className="shell-px relative py-10 sm:py-14 lg:py-16">
        <div className="container-max mx-auto grid items-center gap-11 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-default bg-raised py-1.5 pl-2 pr-3.5 shadow-soft">
              <span className="rounded-full bg-brand-bold px-2 py-0.5 text-inverse">
                <Heading as="span" size="xxsmall">
                  Norsk
                </Heading>
              </span>
              <Text size="small" weight="semibold" tone="subtle">
                Bokmål · reading, lessons and review
              </Text>
            </span>

            <h1 className="mt-5 text-[clamp(2.3rem,3.9vw,3.15rem)] font-semibold leading-[1.02] tracking-tight text-default">
              Read Norwegian tonight.
              <br />
              Know it{' '}
              <span className="relative whitespace-nowrap text-brand">
                on sight
                <svg
                  aria-hidden
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full overflow-visible"
                  preserveAspectRatio="none"
                  viewBox="0 0 200 12"
                >
                  <path
                    d="M2 8C40 3 80 2 118 5s60 4 80 1"
                    fill="none"
                    stroke="var(--border-brand-subtle)"
                    strokeLinecap="round"
                    strokeWidth="5"
                  />
                </svg>
              </span>
              .
            </h1>

            <div className="mt-7 max-w-[36ch]">
              <Text as="p" size="large" smSize="xl" tone="subtle">
                Tap any word you don&rsquo;t know and it becomes a review card —
                in the same queue as every word your grammar lessons taught you.
              </Text>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link to="/login">
                  Read your first story
                  <ArrowRight />
                </Link>
              </Button>
              <div className="text-subtle">
                <Text as="p" size="medium">
                  <Text as="b" size="medium" weight="bold" tone="default">
                    Free.
                  </Text>{' '}
                  No card, no trial, no paid tier.
                </Text>
              </div>
            </div>
          </div>

          <figure className="relative m-0">
            <figcaption className="sr-only">
              Illustration of the Flyt reader: a Norwegian story with the word
              &ldquo;regnet&rdquo; tapped, its dictionary entry, and the review
              queue due today.
            </figcaption>
            <ReaderPreview />
            <div className="mt-4 xl:absolute xl:-right-4 xl:bottom-[-1.75rem] xl:mt-0 xl:w-72">
              <LookupSheet />
            </div>
            <div className="mt-4 flex items-center gap-3 radius-section border border-default bg-overlay p-3 shadow-raised xl:absolute xl:-left-6 xl:bottom-[-1.5rem] xl:mt-0">
              <span className="grid size-9 place-items-center rounded-full bg-success-subtle text-success">
                <Heading as="span" size="xsmall">
                  12
                </Heading>
              </span>
              <div>
                <Text as="div" size="medium" weight="semibold">
                  Due today
                </Text>
                <Text as="div" size="small" tone="subtle">
                  from lessons + reading
                </Text>
              </div>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

LandingHero.displayName = 'LandingHero';
