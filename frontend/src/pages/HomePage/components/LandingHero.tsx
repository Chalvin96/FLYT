import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';

import { LookupSheet } from './LookupSheet';
import { ReaderPreview } from './ReaderPreview';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-1/5 -top-2/5 h-[120%] bg-[radial-gradient(46%_40%_at_22%_18%,var(--primary-30),transparent_70%),radial-gradient(40%_36%_at_82%_8%,var(--secondary-20),transparent_68%)] opacity-70"
      />
      <div className="shell-px relative py-10 sm:py-14 lg:py-16">
        <div className="container-max mx-auto grid items-center gap-11 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-2 pr-3.5 shadow-soft">
              <span className="rounded-full bg-primary-70 px-2 py-0.5 type-label-sm text-white-100">
                Norsk
              </span>
              <span className="type-caption-sm font-semibold text-muted-foreground">
                Bokmål · reading, lessons and review
              </span>
            </span>

            <h1 className="mt-5 font-display text-[clamp(2.3rem,3.9vw,3.15rem)] font-semibold leading-[1.02] tracking-tight text-foreground">
              Read Norwegian tonight.
              <br />
              Know it{' '}
              <span className="relative whitespace-nowrap text-primary-80">
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
                    stroke="var(--primary-40)"
                    strokeLinecap="round"
                    strokeWidth="5"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-7 max-w-[36ch] type-body leading-8 text-muted-foreground sm:type-lead">
              Tap any word you don&rsquo;t know and it becomes a review card —
              in the same queue as every word your grammar lessons taught you.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link to="/login">
                  Read your first story
                  <ArrowRight />
                </Link>
              </Button>
              <p className="type-caption text-muted-foreground">
                <b className="font-bold text-foreground">Free.</b> No card, no
                trial, no paid tier.
              </p>
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
            <div className="mt-4 flex items-center gap-3 radius-section border border-border bg-popover p-3 shadow-raised xl:absolute xl:-left-6 xl:bottom-[-1.5rem] xl:mt-0">
              <span className="grid size-9 place-items-center rounded-full bg-accent-10 font-display type-caption font-bold text-accent-100 dark:bg-accent-90/40 dark:text-accent-20">
                12
              </span>
              <span>
                <b className="block font-display type-caption font-semibold">
                  Due today
                </b>
                <small className="type-caption-sm text-muted-foreground">
                  from lessons + reading
                </small>
              </span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

LandingHero.displayName = 'LandingHero';
